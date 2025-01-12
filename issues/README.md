# Issues

- [ ] [03-djs](./03-djs.md)
- [ ] [05-publish](./05-publish.md)
- [ ] 08. Move logic from `.ts` files to `.f.ts` files.
- [ ] 09. Generating a Website.
- [ ] 10. Short URL table.
- [ ] [11-fs-load](./11-fs-load.md)
- [ ] 13. Docs for JSR. See https://jsr.io/@functionalscript/functionalscript/score
- [ ] 14. Combine `npm run index` and `npm run version`
- [ ] 16. License in JSR file?
- [ ] [17-djs-extension](./17-djs-extension.md).
- [ ] 18. Formatter for `.f.js` and `.f.ts` files.
- [ ] 20. Test framework should be able to run a subset of tests.
- [ ] 21. Test Framework silent mode. Show progress and failed tests only.
- [ ] 23. a console program similar to one that we have in the NaNVM repo.
- [ ] 24. create `./main.ts` that supports the same behavior as current NaNVM Rust implementation:
    - [ ] run `node ./main.ts input.f.mjs output.f.mjs`
    - [ ] run `deno ./main.ts input.f.mjs output.f.mjs`
- [ ] 27. Test Framework parses non-default export.
- [ ] 28. Make a distinction between unit tests, examples, and API tests.
    - Unit tests are completely deterministic. They run every time the module is loaded, so they must be very, very simple and check basic hypotheses. They are not available as a public interface.
      ```ts
      import { unit } from 'dev/unit-test.f.ts'
      unit({
        check4: () => {
            if (2 + 2 !== 4) { throw '2+2 != 4' }
        }
      })
      ```
    - Examples use only public API and are located in `*example.f.ts` files.
    - API tests use only public API and are located in `*test.f.ts` files.
- [ ] 29. Test in a browser. It's important for such browsers as Firefox because we don't have SpiderMonkey as a CLI.
- [ ] 30. Infra for exception-throwing tests that pass on the throw should be improved.
For example, 'throw' field could be not an immediate function but a reference to a helper function that throws
(e.g. 'test_throw') - in this case, the current infra will not recognize the 'throw' as the function name.
Also, 'throw' could be a group of test functions (all of them passing tests when throwing). These improvements
require setting a flag when walking through a test free as soon as a node has a 'throw' as its name.
- [ ] [31-formal-grammar](./31-formal-grammar.md).
- [ ] 32. implement a stupid, non-deterministic parser using [31-formal-grammar](./31-formal-grammar.md).
- [ ] 33. Rust: VM: implement `Any` and other types as wrappers
  ```rust
  struct Any<A: AnyPolicy>(A);
  ```
  This way we can implement operations on it, such as `+`.
- [x] 34. Refactor unary_plus in interface.rs so the runtime error of unary_plus does not keep a value - that
logic should be moved to a private free floating helper function (to keep public interface of Any clean).
- [x] 35. Switch the error case of Any's public functions (like unary_plus) from a custom RuntimeError to Any.
- [ ] 36. Test framework for a browser. We should have an HTML file (e.g. `./dev/test.html`) that can be opened in a browser.
- [ ] 37. Language Design: Currently, FS has no way to store references (objects/functions) in a container with fast search capabilities. Several options:
  - add `Map` to the language
  - use content (serialization). This can be slow with non-CA VM. Functions are still hard to serialize.
- [ ] 38. Rust: bigint: Optimize multiplication https://www.youtube.com/watch?v=AMl6EJHfUWo
- [ ] [./39-radix-encoding.md](./39-radix-encoding.md)
- [ ] 40. TypeScript doesn't show an error if an exported type references a non-exported type. We need to find a way to detect such cases.

  ```ts
  type A = number
  export type B = A | string
  ```

- [ ] 41. BNF should use byte parsing instead of codePoint. In this case, we can parse binary files as well.
- [ ] 42. Try mixing serializable BNFs.
- [ ] 43. state-full parser.

  ```ts
  const { init, append, end } = parser(ruleMap)
  let state = init
  state = append(state, 'hello world!')
  const ast = end(state)
  ```

- [ ] 44. Follow `?` error handling pattern.

  ```rust
  trait Any {
      type Result<T> = Result<T, Self>;
      fn to_number(Self) -> Self::Result<(Self, f64)> { ... }
      fn add(self, b: Self) -> Self::Result<Self> {
          ....
          let (b, num) = self.to_number()?;
          ...
      }
  ...
  }
  ```

- [ ] 45. [nanenum](../nanvm-lib/src/nanenum.rs) should use new [provenance API](https://doc.rust-lang.org/stable/core/ptr/index.html#provenance)
- [ ] 46. Implement an LR(1) parser because LL(1) can't handle break lines in comments.
- [ ] 47. FunctionalScript Compiler should be able to load and run modules as a meta-programming option. When it fails, it should show a good error message similar to a compile-time error.
- [ ] 48. One day, we should switch back to the `.js` extension if [Type Annotation Proposal](https://github.com/tc39/proposal-type-annotations) is included in ECMAScript.
- [X] 49. Delete [com](./com/) and [commonjs](./commonjs). Bump a minor version to `0.4.0`.
- [X] 50. Delete old `bigint.log2` benchmark tests. Leave only `str32log2` and `log2`.

## Language Specification

See [lang/README.md](./lang/README.md).
