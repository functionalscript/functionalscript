# Issues

1. [X] [test-debug](./test-debug.md).
2. [X] [esm](./esm.md)
3. [ ] [djs](./djs.md)
4. [ ] VM Rust project
5. [ ] [publish](publish.md)
6. [ ] fix index generation by including sub modules `{ ...m, add: mAdd, remove: mRemove}`.
7. [ ] Conventions:
    ```js
    import list, * as List from 'list.mjs'
    // list is for objects.
    // List is for types and should be ignored by FJS or errored if used in code.
    ```
8. Move logic from `.mjs` files to `.f.mjs` files.
9. Two sets of property filters:
   - usage `.b`:
     - `constructor`
     - ...
   - call `.b()`:
     - `push`
     - ...
10. [ ] Replace file extensions from `.mjs` to `.js`. Make sure `package.json/type` is equal to `module`. May be later: https://v8.dev/features/modules#mjs
