# Issues

1. [X] [test-debug](./01-test-debug.md).
2. [X] [esm](./02-esm.md)
3. [ ] [djs](./03-djs.md)
4. [ ] VM Rust project
5. [ ] [publish](./05-publish.md)
6. [ ] fix index generation by including sub modules `{ ...m, add: mAdd, remove: mRemove}`.
7. [ ] Conventions:

    ```js
    import list, * as List from 'list.mjs'
    // list is for objects.
    // List is for types and should be ignored by FJS or errored if used in code.
    ```

8. Move logic from `.mjs` files to `.f.mjs` files.
9. [ ] Generating a Website.
10. [ ] Short URL table.
11. [ ] [fs-load](./11-fs-load.md)
12. [ ] Replace file extensions from `.mjs` to `.js`. Make sure `package.json/type` is equal to `module`. May be later: https://v8.dev/features/modules#mjs
13. [ ] Docs for JSR. See https://jsr.io/@functionalscript/functionalscript/score
14. [ ] Combine `npm run index` and `npm run version`
15. [ ] Generate `package.json/exports` instead of `index.f.mjs`.
16. [ ] License in JSR file?
17. [ ] [djs-extension](./17-djs-extension.md).
18. [ ] Formatter for `.f.js` and `.f.ts` files.
19. [ ] Convert FunctionalScript code using non-default `export`.
20. [ ] Test framework should be able to run a subset of tests.
21. [ ] Test Framework silent mode. Show progress and failed tests only.
22. [x] bit sequences based on bigint
23. [ ] a console program similar to one that we have in the NaNVM repo.
24. [ ] create `./module.mjs` that supports the same behavior like current NaNVM Rust implementation:
    - [ ] run `node ./module.mjs input.f.mjs output.f.mjs`
    - [ ] run `deno ./module.mjs input.f.mjs output.f.mjs`
25. [ ] Switch to Deno an `.ts`?
    1. Deno TypeScript and Microsoft TypeScript are different https://bsky.app/profile/macwright.com/post/3lbrwioa5zs27
    2. One day we may switch back to `.js` extension if [Type Annotation Proposal](https://github.com/tc39/proposal-type-annotations) is included into ECMAScript. BTW, we should only use JS with type annotations instead of full TypeScript.
26. [ ] Test Framework should recognize `throw` conventions.
    ```ts
    export default {
        'throw': () => { throw }
    }
    ```
27. [ ] Test Framework parse non-default export.

## Language Specification

See [lang/README.md](./lang/README.md).
