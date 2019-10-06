




//////////////////// configure the update here!
///
///
/// the type of version update
const version = 'patch';
///
///
/// the dependencies that need an update
const packages = [
    //'distributed-prototype'
    'ee-soa-service',
    //'related',
];
///
///
/// additional files to commit
const commitFiles = [
    //'distributed-prototype'
    //'service.js'
];
///
///
/// the commitmessage to use
//const commitMessage = 'fix: add missing controller';
const commitMessage = 'chore: update dependencies';
///
///
///
//////////////////// configure the update here!







const ebDependencies = new Set([
    "address-condition-service",
    "authentication-condition-service",
    "blog-service",
    "canalposte-service",
    "cornercard-frontend",
    "datatrans-service",
    "eb-api-frontend",
    "eb-resource-client",
    "eb-service-cluster",
    "eb-service-eventdata",
    "eb-service-generics",
    "eb-service-image",
    "eb-service-mail",
    "eb-service-object",
    "eb-service-promotion",
    "eb-service-report",
    "eb-service-resource",
    "eb-service-shopping",
    "eb-service-user",
    "eventbooster-frontend",
    "events.ch-frontend",
    "file-api-service",
    "media-service",
    "mothership-backoffice",
    "post-ticket-frontend",
    "prepaid-service",
    "promo-feed-service",
    "shopping-service",
    "storage-service",
    "superuser-discount-condition-service",
    "tos-condition-service",
    "xml-feed-service"
]);


const path = require('path');
const fs = require('fs');
const promisify = require('util').promisify;
const semver = require('semver');
const exec = promisify(require('child_process').exec);
const writeFile = promisify(fs.writeFile);
const log =  require('ee-log');


const isDryRun = process.argv.includes('--dry-run');





class UpdateDependencies {


    async execute({
        version = 'patch',
        dependencies = [],
        commitFiles = [],
        commitMessage = 'chore: update dependencies',
    }) {
        if (!dependencies.length) throw new Error(`please specify at least one dependency you wish to update!`);

        for (const packageName of ebDependencies.values()) {
            const packagePath = path.join(__dirname, '../', packageName);

            if (this.hasDependency(packagePath, dependencies)) {
                
                // check if there is anything uncommited
                const result = await exec(`cd ${packagePath} && git diff-index --quiet HEAD -- || echo "untracked"`);

                if (result.stdout.trim() === 'untracked' || !commitFiles.length) {
                    await this.update({
                        version,
                        packagePath,
                        packageName,
                        commitFiles, 
                        commitMessage,
                    });
                }
            }
        }
    }



    hasDependency(packagePath, dependencies) {
        const packageJson = require(path.join(packagePath, 'package.json'));
        return dependencies.some(dep => packageJson.dependencies[dep]);
    }




    async update({
        version,
        packagePath,
        packageName,
        commitFiles, 
        commitMessage,
    }) {
        const jsonPath = path.join(packagePath, 'package.json');
        const packageJson = require(jsonPath);
        const oldVersion = packageJson.version;
        let newVersion = semver.inc(oldVersion, version);

        // move all versions to at least 1.0.0
        if (semver.lt(oldVersion, '1.0.0')) newVersion = '1.0.0';


        const branchName = await this.getBranch(packagePath);
        if (branchName !== 'develop') throw new Error(`Cannot update ${packageName}, it is not on the develop branch!`);

        // set new package version
        log.info(`${packageName}: increased version from ${oldVersion} to ${newVersion} (${packagePath})`);
        if (!isDryRun) {
            packageJson.version = newVersion;
            await writeFile(jsonPath, JSON.stringify(packageJson));
        }
       

        await this.updatePackages(packagePath);
        await this.tagAndCommitAndPublish({
            packagePath,
            newVersion,
            commitFiles, 
            commitMessage,
        });
    }



    async updatePackages(packagePath) {
        if (!isDryRun) {
            try {
                await exec(`cd ${packagePath} && rm -r node_modules`);
            } catch (r) {}
            
            await exec(`cd ${packagePath} && npm update --nodedir=/home/ee/dev/nodejs/node/`);
        }
    }



    async getBranch(packagePath) {
        const result = await exec(`cd ${packagePath} && git rev-parse --abbrev-ref HEAD`);
        return result.stdout.trim();
    }



    async tagAndCommitAndPublish({
        packagePath,
        newVersion,
        commitFiles, 
        commitMessage,
    }) {
        if (!isDryRun) {
                
            await exec(`cd ${packagePath} && git commit package.json package-lock.json ${commitFiles.join(' ')} -m "${commitMessage}" && git push`);
            await exec(`cd ${packagePath} && git tag -a v${newVersion} -m "${commitMessage}" && git push origin v${newVersion}`);
            await exec(`cd ${packagePath} && npm publish`);
        }
    }
}










const updater = new UpdateDependencies();


log.warn('starting update ....');
if (isDryRun) log.warn('dry-run!');
updater.execute({
    version: version,
    dependencies: packages,
    commitMessage: commitMessage,
    commitFiles: commitFiles,
}).then(() => {
    log.success('update done');
}).catch(log);