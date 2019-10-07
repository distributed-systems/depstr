import RainbowConfig from '@rainbow-industries/rainbow-config';
import glob from '@distributed-systems/glob';
import logd from 'logd';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execute = promisify(exec);
const { promises: { readFile } } = fs; 
const log = logd.module('updater');




export default class Updater {


    constructor({
        isDryRun = process.argv.includes('--dry-run'),
        cwd,
        version = 'patch',
    }) {
        this.cwd = cwd;
        this.isDryRun = isDryRun;
        this.version = version;

        this.packagesToUpdate = new Set();
        this.dependenciesToUpdate = new Set();
    }





    async update() {
        await this.loadConfig();
        const localPackageMap = await this.collectLocalPackages();
        const packagesToUpdate = new Set();

        for (const packageNameRegExp of this.packagesToUpdate.keys()) {
            for (const [packageName, packageConfig] of localPackageMap.entries()) {
                packageNameRegExp.lastIndex = 0;

                if (packageNameRegExp.test(packageName)) {
                    packagesToUpdate.add(packageConfig);
                }
            }
        }


        // check if the matched package has a matching dependency
        for (const config of packagesToUpdate.values()) {
            let updateRequired = false;

            if (config.json.dependencies) {
                for (const dependency of Object.keys(config.json.dependencies)) {
                    if (this.dependenciesToUpdate.has(dependency)) {
                        updateRequired = true;
                        break;
                    }
                }
            }

            if (config.json.devDependencies) {
                for (const devDependency of Object.keys(config.json.devDependencies)) {
                    if (this.dependenciesToUpdate.has(devDependency)) {
                        updateRequired = true;
                        break;
                    }
                }
            }

            if (updateRequired === false) {
                packagesToUpdate.delete(config);
            }
        }


        for (const config of packagesToUpdate) {
            await this.updatePackage(config.path);
        }
    }






    async updatePackage(packagePath) {
        const hasChanges = await this.hasChanges(packagePath);
        if (hasChanges) {
            log.warn(`Cannot update ${packagePath}: there are uncommited changes!`);
            return;
        }


        const branchName = await this.getBranch(packagePath);
        if (branchName !== 'develop') {
            log.warn(`Cannot update ${packagePath}, not updating packages in a branch other than develop, current branch is {${branchName}}`);
            return;
        }


        await this.updateNPPMPackages(packagePath);
        await this.updateVersion(packagePath);
        await this.publish(packagePath);
    }




    async publish(packagePath) {
        await execute(`cd ${packagePath} && npm publish`);
    }




    async updateVersion(packagePath) {
        await execute(`cd ${packagePath} && npm version ${this.version}`);
        await execute(`cd ${packagePath} && git push`);
        await execute(`cd ${packagePath} && git push --tags`);
    }
    





    async updateNPPMPackages(packagePath) {
        log.debug(`Updating dependencies for ${packagePath}`);

        if (!this.isDryRun) {
            try {
                await execute(`cd ${packagePath} && rm -r node_modules`);
            } catch (r) {}
            
            await execute(`cd ${packagePath} && npm update`);
        }
    }






    async hasChanges(packagePath) {
        const result = await execute(`cd ${packagePath} && git diff-index --quiet HEAD -- || echo "untracked"`);
        return result.stdout.trim() === 'untracked';
    }




    async getBranch(packagePath) {
        const result = await execute(`cd ${packagePath} && git rev-parse --abbrev-ref HEAD`);
        return result.stdout.trim();
    }




    async collectLocalPackages() {
        const localPackages = await glob(path.join(this.cwd, '../'), '*/package.json');
        const packageMap = new Map();

        for (const packageName of localPackages) {
            const json = await this.loadPackageJSON(packageName);
            packageMap.set(json.name, { path: path.dirname(packageName), json });
        }

        return packageMap;
    }





    async loadPackageJSON(jsonPath) {
        const packagePath = path.join(jsonPath);

        try {
            return JSON.parse((await readFile(packagePath)).toString());
        } catch (err) {
            throw new Error(`Failed to load package.json from ${packagePath}: ${err.message}`);
        }
    }




    async loadConfig() {
        for (const parameter of process.argv) {
            const configMatch = /^--group=(?<configName>.*)$/i.exec(parameter);

            if (configMatch) {
                const configDir = path.join(this.cwd, './config/depstr');

                log.debug(`Loading config from ${configDir}`);
                const config = new RainbowConfig(configDir);
                await config.load();

                const configuration = config.get(configMatch.groups.configName);
                if (!configuration || !configuration.dependencies || !configuration.packages) {
                    throw new Error(`Failed to laod config key ${configMatch.groups.configName} from config in dir ${configDir}!`);
                }

                for (const packageName of configuration.packages) {
                    this.packagesToUpdate.add(new RegExp(`^${packageName.replace('*', '.*')}$`, 'i'));
                }

                for (const dependencyName of configuration.dependencies) {
                    this.dependenciesToUpdate.add(dependencyName);
                }
            }
        }
    }    
}

