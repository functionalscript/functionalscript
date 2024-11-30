# Issues

1. [X] [test-debug](./test-debug.md).
2. [X] [esm](./esm.md)
3. [ ] [publish](publish.md)
4. [ ] fix index generation by including sub modules `{ ...m, add: mAdd, remove: mRemove}`.
5. [ ] Conventions:
    ```js
    import list, * as List from 'list.mjs'
    // list is for objects.
    // List is for types and should be ignored by FJS or errored if used in code.
    ```
6. [X] PoC: Replace `while` with recursive generators. **Result:** doesn't work.
7. Two sets of property filters:
   - usage `.b`:
     - `constructor`
     - ...
   - call `.b()`:
     - `push`
     - ...
