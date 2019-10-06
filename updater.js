#!/usr/bin/env node


import logd from 'logd';
import ConsoleTransport from 'logd-console-transport';
import Updater from './src/Updater.js';

logd.transport(new ConsoleTransport());
const log = logd.module('Updater');


(async() => {
    const updater = new Updater({
        cwd: process.env.INIT_CWD || process.cwd(),
    });


    await updater.update();
})().then(() => {
    log.success(`update complete!`);
}).catch(log);