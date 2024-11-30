# Issues

1. [X] [test-debug](./test-debug.md).
2. [X] [esm](./esm.md)
3. [ ] [djs](./djs.md)
4. [ ] [publish](publish.md)
5. [ ] fix index generation by including sub modules `{ ...m, add: mAdd, remove: mRemove}`.
6. [ ] Conventions:
    ```js
    import list, * as List from 'list.mjs'
    // list is for objects.
    // List is for types and should be ignored by FJS or errored if used in code.
    ```
7. Move logic from `.mjs` files to `.f.mjs` files.
8. Two sets of property filters:
   - usage `.b`:
     - `constructor`
     - ...
   - call `.b()`:
     - `push`
     - ...
9. [ ] Replace file extensions from `.mjs` to `.js`. Make sure `package.json/type` is equal to `module`. May be later: https://v8.dev/features/modules#mjs
