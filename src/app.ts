import Queue from 'bull';
import execa from 'execa';
import Fastify from 'fastify';
import fs from 'fs-extra';
import latestVersion from 'latest-version';
import path from 'path';
import { performance } from 'perf_hooks';
import rp from 'request-promise';

import { InstalledPackage } from './models/installed-package';
import { NjinnServer } from './models/njinn-server';
import { NpmPackage } from './models/npm-package';
import { ServerOptions } from './models/server-options';
import { Webhook } from './models/webhook';
import { getInstalledPackages } from './utils';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';

async function buildQueue(): Promise<Queue.Queue> {
    const queue = new Queue('nJinn', { redis: { host: REDIS_HOST } });
    queue.process(100, async function (job, done) {
        try {
            const { id, context } = job.data;
            const result = await require(path.resolve(`./generated/${id}`))(context);
            done(null, result);
        } catch (err) {
            done(err);
        }
    });

    queue.on('completed', async (job, result) => {
        await statusRequest(job.data.webhook, {
            ...job.data,
            status: 'success',
            result,
        });
    });

    queue.on('failed', async function (job, err) {
        await statusRequest(job.data.webhook, {
            ...job.data,
            status: 'fail',
        });
    })

    queue.on('active', async function (job, jobPromise) {
        await statusRequest(job.data.webhook, {
            ...job.data,
            status: 'loading',
        });
    })

    async function statusRequest(webhook: Webhook, data: any) {
        await rp({
            method: 'POST',
            uri: webhook.url,
            body: {
                id: data.id,
                result: data.result,
                status: data.status,
                timestamp: performance.now() + performance.timeOrigin,
            },
            rejectUnauthorized: false,
            json: true,
            headers: webhook.headers,
        })
    }

    await queue.isReady();

    return queue;
}

export async function startServer(options: ServerOptions): Promise<NjinnServer> {
    const fastify = Fastify();
    const queue = await buildQueue();

    fastify.post('/saveScript', async (request, reply) => {
        const { script, id } = request.body;
        if (!id) {
            throw new Error('id is required');
        }
        const fileName = `./generated/${id}`;
        await fs.outputFile(fileName, script);
        delete require.cache[path.resolve(fileName)];
        reply.send();
    });

    fastify.post('/queueJobs', (request, reply) => {
        const jobs = request.body as any[];
        if (jobs) {
            jobs.forEach(job => {
                queue.add(job, { removeOnComplete: true, removeOnFail: true, });
            });
        }
        reply.send();
    });

    fastify.post('/executeScript', async (request, reply) => {
        const { id, context } = request.body;
        const result = await require(path.resolve(`./generated/${id}`))(context);
        reply.send(result);
    });

    fastify.post('/installPackages', async (request, reply) => {
        await installPackages(request.body);
        reply.send();
    });

    async function installPackages(packages: NpmPackage[] = []) {
        await execa('npm', ['init', '-y'], { cwd: './generated' });
        const installedPackages = await getPackages(packages.map(x => x.package));
        for (let i = 0; i < packages.length; i++) {
            const packageName = packages[i].package;
            const version = packages[i].version || 'latest';
            const installedPackage = installedPackages.find(x => x.name === packageName);
            const packageWithVersion = `${packageName}@${version}`;
            const alreadyInstalled = installedPackage && (installedPackage.installed === version || (version === 'latest' && installedPackage.installed === installedPackage.latest));
            if (!alreadyInstalled) {
                await execa('npm', ['install', packageWithVersion], { cwd: './generated' });
            }
        }
    }

    async function getPackages(packageNames: string[] = []): Promise<InstalledPackage[]> {
        const packages = await getInstalledPackages('./generated');
        const installedPackages = [];
        for (let i = 0; i < packageNames.length; i++) {
            const packageName = packageNames[i];
            const latestPackageVersion = await latestVersion(packageName);
            if (packages[packageName]) {
                installedPackages.push({
                    name: packageName,
                    installed: packages[packageName],
                    latest: latestPackageVersion,
                });
            }
        }

        return installedPackages;
    }

    fastify.addHook('onClose', async (instance, done) => {
        await queue.close();
        done();
    });

    await fastify.listen(options.port, '0.0.0.0');
    console.log(`Server started at http://localhost:${options.port}`);

    return {
        close: fastify.close,
    };
}
