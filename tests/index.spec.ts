import fs from 'fs-extra';
import { performance } from 'perf_hooks';
import rp from 'request-promise';

import { startServer } from '../src/app';
import { NpmPackage } from '../src/models/npm-package';
import { collectData } from './helpers';

import latestVersion from 'latest-version';
import { getInstalledPackages } from '../src/utils';
import { NjinnServer } from '../src/models/njinn-server';

jest.mock('perf_hooks');
let server: NjinnServer;

beforeEach(() => {
    jest.resetModules();
});

beforeAll(async () => {
    server = await startServer({ port: 3033 });
});

afterAll(async () => {
    await server.close();
});

beforeEach(async () => {
    await fs.emptyDir(`./generated`);
    let time = 0;
    (performance as any).timeOrigin = 0;
    performance.now = () => time++;
});

describe('/saveScipt', () => {
    it('saves script to the file system with correct file name', async () => {
        const script = `console.log('abc')`;
        await rp({
            method: 'POST',
            url: 'http://localhost:3033/saveScript',
            body: {
                id: 'abc.js',
                script,
            },
            json: true,
        });

        const fileContents = await fs.readFile('./generated/abc.js', 'utf8');
        expect(fileContents).toEqual(script);
    });

    it(`throws error if id is not specified`, async () => {
        try {
            await rp({
                method: 'POST',
                url: 'http://localhost:3033/saveScript',
                body: {},
                json: true,
            });
        } catch (e) {
            expect(e).toMatchSnapshot();
        }
    });
});

describe('/installPackages', () => {
    it('installs latest version of package if version is not specified', async () => {
        await rp({
            method: 'POST',
            url: 'http://localhost:3033/installPackages',
            body: [{
                name: 'is-number',
            }] as NpmPackage[],
            json: true,
        });
        const packages = await getInstalledPackages('./generated');
        const latestPackageVersion = await latestVersion('is-number');
        expect(packages['is-number']).toEqual(latestPackageVersion);
    });

    it('installs specific version of package', async () => {
        const version = '2.0.0';
        await rp({
            method: 'POST',
            url: 'http://localhost:3033/installPackages',
            body: [{
                name: 'is-number',
                version,
            }] as NpmPackage[],
            json: true,
        });
        const packages = await getInstalledPackages('./generated');
        expect(packages['is-number']).toEqual(version);
    });
});

describe('/queueJobs', () => {
    it('executes successfull script in the background and sends status', async () => {
        await rp({
            method: 'POST',
            url: 'http://localhost:3033/saveScript',
            body: {
                id: 'abc.js',
                script: `module.exports = () => { return 123; }`,
            },
            json: true,
        });
        const data = await collectData({
            port: 3034,
            length: 2,
            afterInit: async () => {
                await rp({
                    method: 'POST',
                    url: 'http://localhost:3033/queueJobs',
                    body: [{
                        id: 'abc.js',
                        webhook: { url: 'http://localhost:3034/webhook' }
                    }],
                    json: true,
                })
            }
        });
        expect(data).toMatchSnapshot();
    });

    it('executes failing script in the background and sends status', async () => {
        await rp({
            method: 'POST',
            url: 'http://localhost:3033/saveScript',
            body: {
                id: 'abc.js',
                script: `module.exports = () => { throw new Error(123); }`,
            },
            json: true,
        });
        const data = await collectData({
            port: 3034,
            length: 2,
            afterInit: async () => {
                await rp({
                    method: 'POST',
                    url: 'http://localhost:3033/queueJobs',
                    body: [{
                        id: 'abc.js',
                        webhook: { url: 'http://localhost:3034/webhook' }
                    }],
                    json: true,
                })
            }
        });
        expect(data).toMatchSnapshot();
    });
});

describe('/executeScript', () => {
    it('executes successfull script', async () => {
        await rp({
            method: 'POST',
            url: 'http://localhost:3033/saveScript',
            body: {
                id: 'abc.js',
                script: `module.exports = () => { return 123; }`,
            },
            json: true,
        });
        const result = await rp({
            method: 'POST',
            url: 'http://localhost:3033/executeScript',
            body: {
                id: 'abc.js',
            },
            json: true,
        });
        expect(result).toEqual(123);
    });

    it('executes failing script', async () => {
        await rp({
            method: 'POST',
            url: 'http://localhost:3033/saveScript',
            body: {
                id: 'abc.js',
                script: `module.exports = () => { throw new Error(123); }`,
            },
            json: true,
        });
        try {
            await rp({
                method: 'POST',
                url: 'http://localhost:3033/executeScript',
                body: {
                    id: 'abc.js',
                },
                json: true,
            });
        } catch (err) {
            // console.log(err);
            expect(err).toMatchSnapshot();
        }
    });
});