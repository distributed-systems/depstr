import RainbowConfig from '@rainbow-industries/rainbow-config';
import glob from '@distributed-systems/glob';
import path from 'path';
import fs from 'fs';
import logd from 'logd';
import { promisify } from 'util';
import { exec } from 'child_process';

const execute = promisify(exec);
const log = logd.module('linker');
const { promises: { readFile } } = fs; 



export default class Linker {


    constructor({
        cwd,
        isMainProject = false,
        isDryRun = process.argv.includes('--dry-run'),
        recursive = process.argv.includes('-r'),
        linkedDependencies = new Set()
    }) {
        this.linkedDependencies = linkedDependencies;
        this.isDryRun = isDryRun;
        this.isMainProject = isMainProject;
        this.cwd = cwd;
        this.configPath = path.join(cwd, 'config/depstr');
    }





    async link() {
        log.warn(`Linking dependencies for package ${this.cwd}`);

        try {
            await this.loadConfig();
        } catch (err) {
            if (this.isMainProject) {
                // the main project must have a config, all others not
                throw new Error(`Failed to load configfile from ${this.configPath}: ${err.message}`);
            } else {
                log.debug(`Failed to load configfile for ${this.configPath}: ${err.message}`);
                return;
            }
        }

        this.packageJSON = await this.loadPackageJSON(path.join(this.cwd, 'package.json'));


        const dependenciesArray = [];

        if (this.config.get('dependencies')) {
            const toBeInstalledDependencies = await this.resolveDependencies(this.config.get('dependencies'), this.packageJSON.dependencies || {});
            dependenciesArray.push(...toBeInstalledDependencies);
        }

        if (this.config.get('dev-dependencies')) {
             const toBeInstalledDependencies = await this.resolveDependencies(this.config.get('dev-dependencies'), this.packageJSON.devDependencies || {});
            dependenciesArray.push(...toBeInstalledDependencies);
        }

        const localPackages = await this.collectLocalPackages();

        for (const packageName of (new Set(dependenciesArray).keys())) {
            if (!localPackages.has(packageName)) {
                throw new Error(`Cannot link package ${packageName} from ${this.cwd}: Package not found in the ${path.join(this.cwd, '../')} directory!`);
            }

            await this.linkDependency(localPackages.get(packageName));

            if (!this.linkedDependencies.has(packageName)) {
                this.linkedDependencies.add(packageName);

                const linker = new Linker({
                    cwd: localPackages.get(packageName),
                    linkedDependencies: this.linkedDependencies,
                    isDryRun: this.isDryRun,
                });

                await linker.link();
            }
        }
    }




    async collectLocalPackages() {
        const localPackages = await glob(path.join(this.cwd, '../'), '*/package.json');
        const packageMap = new Map();

        for (const packageName of localPackages) {
            const json = await this.loadPackageJSON(packageName);
            packageMap.set(json.name, path.dirname(packageName));
        }

        return packageMap;
    }




    /**
     * checks which dependencies should be linked
     *
     * @param      {array}    dependencyList       lsit of to be linked dependencies form the depstr
     *                                             config file
     * @param      {object}   packageDependencies  all dependencies that are part of th
     *                                             epackage.json file
     */
    async resolveDependencies(dependencyList, packageDependencies) {
        const packageDependenciesSet = new Set(Object.keys(packageDependencies));
        const toBeInstalledDependencies = [];

        for (const dependency of dependencyList) {
            if (dependency.includes('*')) {
                const reg = new RegExp(dependency.replace('*', '.*'), 'gi');

                for (const dep of packageDependenciesSet.keys()) {
                    reg.lastIndex = 0;
                    if (reg.test(dep)) {
                        toBeInstalledDependencies.push(dep);
                    }
                }
            } else if (packageDependenciesSet.has(dependency)) {
                toBeInstalledDependencies.push(dependency);
            }
        }


        return toBeInstalledDependencies;
    }




    async linkDependency(sourcePath) {
        log.info(`Linking ${sourcePath} to ${this.cwd} ...`);
        
        if (!this.isDryRun) {
            await execute(`cd ${this.cwd} && npm link ${sourcePath}`);
        }
    }




    async loadPackageJSON(jsonPath) {
        const packagePath = path.join(jsonPath);

        try {
            return JSON.parse((await readFile(packagePath)).toString());
        } catch (err) {
            throw new Error(`Failed to laod package.json from ${packagePath}: ${err.message}`);
        }
    }




    async loadConfig() {
        this.config = new RainbowConfig(this.configPath);
        await this.config.load();
    }
}