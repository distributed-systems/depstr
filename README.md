# Depstr

a tool to keep your dependencies and package links up to date 


## Commands


### update --dry-run --config=rda-service



### link -r --dry-run

Automatically links packages to local available versions. Which packages are linked 
is defined in a config file. if the `-r` option is used all linked dependencies will
also be linked to their dependencies.

***Installation***

Add an npm script to your package.json

```json
{
    "scripts": {
        "link": "node --experimental-modules --no-warnings ./node_modules/.bin/linker --dev --l"
    }
}
```

***Configfile***

The config file must reside in the config/depstr directory and have the the name `config.dev.yml`.
the contents are as follows. Modules can also be selected using wildcards. All modules in the package.json
are matched against the modules found in this config file. Matches are looked for in the same directory
as the current package resides in. 

```yaml
dependencies:
    - module
    - module*
    - @company/*
dev-dependencies:
    - module

```
