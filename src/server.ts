#!/usr/bin/env node
import commander from 'commander';

import { startServer } from './app';

(async () => {
    const program = new commander.Command();
    program
        .name('njinn')
        .requiredOption('-p, --port <port>', 'port');
    program.parse(process.argv);
    const { port } = program;
    await startServer({ port });
})();