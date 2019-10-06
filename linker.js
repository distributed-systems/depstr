#!/usr/bin/env node


import logd from 'logd';
import ConsoleTransport from 'logd-console-transport';
import Linker from './src/Linker.js';

logd.transport(new ConsoleTransport());
const log = logd.module('linker');


(async() => {
    const linker = new Linker({
        isMainProject: true,
        cwd: process.env.INIT_CWD || process.cwd(),
    });


    await linker.link();
})().then(() => {
    log.success(`linking complete!`);
}).catch(log);