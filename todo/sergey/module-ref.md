## Module References

Imagine every module (in this example: `a`, `b`, `c`) has its own history in CAS using evo objects. Each evo object has a name (or multiple names). A module references other modules using these names. Evo objects may references a lock file. The lock file resolve module to a specific commit. Now, the task is to design import path so that we can extract FunctionalScript module and its dependencies to a file system in the way the root module can be loaded into any ECMAScript engine that supports modules.

Because we can have diamond dependencies where a specific revision can be resolved differently, each module is a directory which contains all dependent modules:

- `a/module.f.js`
  ```js
  import { x } from './b/module.f.js'
  import { z } from './d/module.f.js'
  export const m = x + z
  ```
- `a/b/module.f.js`
  ```js
  import { y } from './c/module.js'
  export const x = y * 2
  ``
- `a/b/c/module.f.js`
  ```js
  export const y = 3
  ```
- `a/d/module.f.js`
  ```js
  export const z = 5
  ```

It's very similar to `node_modules/` where each module can have its own `node_modules/`. The main difference is that we can't change path resolver.

That's the reason we use `./b/module.f.js` instead of flatten `../b/module.f.js`.

## Common Modules

This tree module structure helps a lot to resolve module conflicts but we may also have a lot of duplications. Since we can't change files, and module resolvers, the main question is if we can use symlinks to deduplicate the same modules. Note, we may symlinks the whole directory.

Questions:
-

## Algorithm

Deduplicating symlink algorithm must not carry about where did we get information from, it just deduplicate files and directories if they are the same. We assume that nobody should change the modules.

## Archive

For archive we should use TAR because it preserves and restore hard-links and symlinks.

## Web

We can use redirect, for example, when Cloudflare has `_redirects`. Note, redirects should not be use for files only because it changes path but it can be used for the whole directory, for example, when we use the same lock object.

Both, HTTP redirect and import map mapping changes relative module path.
