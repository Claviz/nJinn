import Fastify from 'fastify';

interface CollectDataOptions {
    port: number;
    length: number;
    /**
     * Callback that will be called after server is started.
     */
    afterInit: () => Promise<any>;
}

/**
 * Starts server on specific port and waits until required data will be collected.
 * @param options 
 */
export async function collectData(options: CollectDataOptions) {
    return new Promise<any[]>(async (resolve, reject) => {
        const data: any[] = [];
        const fastify = Fastify();
        fastify.post('/webhook', async (request, reply) => {
            reply.send();
            data.push(request.body);
            if (data.length === options.length) {
                await fastify.close();
                resolve(data);
            }
        });
        await fastify.listen(options.port);
        await options.afterInit();
    });
}