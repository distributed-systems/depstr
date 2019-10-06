# Depstr

a tool to keep your dependencies and package links up to date 


## Commands

### link -r

links a graph of packages with each other. Each module needs to have a config 
that defines which modules must be linked. The -r flag tells the command to 
recursively go through all packages until no links can be found anymore.

The config file defines which packages from the package.json need to be linked.


```yaml
dependencies:
    - module
    - module: path/to/module
    - prefix*
    - @namespace/module
    - @namespace/prefix*
    - @namespace/prefix*: path/to/module/prefix[0]

dev-dependencies:
    - module
    - prefix*
    - @namespace/module
    - @namespace/prefix*

```


### update-dependency glob expression

Updates dependencies in all packages found using a glob expression. the config
file defines which packages to update 



```yaml
my-config:
    - module
    - prefix*
    - @namespace/module
    - @namespace/prefix*
```