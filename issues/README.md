# Issues

- [X] [01-test-debug](./01-test-debug.md).
- [X] [02-esm](./02-esm.md)
- [ ] [03-djs](./03-djs.md)
- [ ] 04. VM Rust project
- [ ] [05-publish](./05-publish.md)
- [X] 07. Conventions:

    ```js
    import list, * as List from 'list.mjs'
    // list is for objects.
    // List is for types and should be ignored by FJS or errored if used in code.
    ```

- [ ] 08. Move logic from `.ts` files to `.f.ts` files.
- [ ] 09. Generating a Website.
- [ ] 10. Short URL table.
- [ ] [11-fs-load](./11-fs-load.md)
- [X] 12. Replace file extensions from `.mjs` to `.js`. Make sure `package.json/type` is equal to `module`. May be later: https://v8.dev/features/modules#mjs
- [ ] 13. Docs for JSR. See https://jsr.io/@functionalscript/functionalscript/score
- [ ] 14. Combine `npm run index` and `npm run version`
- [X] 15. Generate `package.json/exports` instead of `index.f.mjs`.
- [ ] 16. License in JSR file?
- [ ] [17-djs-extension](./17-djs-extension.md).
- [ ] 18. Formatter for `.f.js` and `.f.ts` files.
- [X] 19. Convert FunctionalScript code using non-default `export`.
- [ ] 20. Test framework should be able to run a subset of tests.
- [ ] 21. Test Framework silent mode. Show progress and failed tests only.
- [x] 22. bit sequences based on bigint
- [ ] 23. a console program similar to one that we have in the NaNVM repo.
- [ ] 24. create `./main.ts` that supports the same behavior like current NaNVM Rust implementation:
    - [ ] run `node ./main.ts input.f.mjs output.f.mjs`
    - [ ] run `deno ./main.ts input.f.mjs output.f.mjs`
- [X] 25. Switch to Deno an `.ts`?
    1. Deno TypeScript and Microsoft TypeScript are different https://bsky.app/profile/macwright.com/post/3lbrwioa5zs27
    2. One day we may switch back to `.js` extension if [Type Annotation Proposal](https://github.com/tc39/proposal-type-annotations) is included into ECMAScript. BTW, we should only use JS with type annotations instead of full TypeScript.
- [x] 26. Test Framework should recognize `throw` conventions.
    ```ts
    export default {
        'throw': () => { throw }
    }
    ```
- [ ] 27. Test Framework parse non-default export.
- [ ] 28. Make a distinction between unit tests, examples and API tests.
    - Unit tests are completely deterministic. They run every time module is loaded so they must be very very simple and check basic hypothesis. They are not available as public interface.
      ```ts
      import { unit } from 'dev/unit-test.f.ts'
      unit({
        check4: () => {
            if (2 + 2 !== 4) { throw '2+2 != 4' }
        }
      })
      ```
    - Examples use only public API and located in `*example.f.ts` files.
    - API tests use only public API and located in `*test.f.ts` files.
- [ ] 29. Test in a browser. It's important for such browsers as FireFox because we don't have SpiderMonkey as a CLI.
- [ ] 30. Infra for exception-throwing tests that pass on throw (see point 26 above) should be improved.
For example, 'throw' field could be not an immediate function but a reference to a helper function that throws
(e.g. 'test_throw') - in this case the current infra will not recognize the 'throw' as the function name.
Also, 'throw' could be a group of test functions (all of them passing tests when throwing). These improvements
require setting a flag when walking through a test free, as soon as a node has a 'throw' as its name.
- [ ] [31-formal-grammar](./31-formal-grammar.md).
- [ ] 32. implement a stupid, non-deterministic parser using [31-formal-grammar](./31-formal-grammar.md).
- [ ] 33. Rust: VM: implement `Any` and other types as wrappers
  ```rust
  struct Any<A: AnyPolicy>(A);
  ```
  This way we can implement operations on it, such as `+`.
- [ ] 34. Refactor unary_plus in interface.rs so the runtime error of unary_plus does not keep a value - that
logic should be moved to a private free floating helper function (to keep public interface of Any clean).
- [ ] 35. Switch the error case of Any's public functions (like unary_plus) from a custom RuntimeError to Any.

## Language Specification

See [lang/README.md](./lang/README.md).
