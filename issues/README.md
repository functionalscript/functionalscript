# Issues

- [X] [03-djs](./03-djs.md)
- [ ] [05-publish](./05-publish.md)
- [ ] 09. Generating a Website.
- [ ] 10. Short URL table.
- [ ] [11-fs-load](./11-fs-load.md)
- [ ] 13. Docs for JSR. See https://jsr.io/@functionalscript/functionalscript/score
- [ ] 16. License in JSR file?
- [X] [17-djs-extension](./17-djs-extension.md).
- [ ] 18. Find a formatter for `.f.js` and `.f.ts` files.
- [ ] P5 20. Test framework should be able to run a subset of tests.
- [ ] [21-test-framework-silent-mode](./21-test-framework-silent-mode.md). Silent mode with light progress by default; use `--verbose` for full output.
- [ ] 23. a console program similar to one that we have in the NaNVM repo.
- [ ] 24. create `./fsc.ts` that supports the same behavior as current NaNVM Rust implementation:
    - [ ] run `node ./fsc.ts input.f.js output.f.js`
    - [ ] run `deno ./fsc.ts input.f.js output.f.js`
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
- [ ] [51-parser-structures.md](./51-parser-structures.md).
- [ ] [52-poker.md](./52-poker.md).
- [ ] [54-token-plus.md](./54-token-plus.md)
- [ ] 55. Add Carbon advertisements on a web site https://www.carbonads.net/
- [ ] 56. Translate the Byte Code into WebAssembly or other PLs, Rust/Zig/C/C++/LLVM.
- [ ] 57. https://github.com/Agoric/eslint-config-jessie
- [ ] 58. 1) There is a todo in line 259 of big_uint.rs, that issue should be clarified.
          2) Replace panic in BigUint::shl with returning an error code.
- [ ] 59. Hash table improvement https://arxiv.org/pdf/2501.02305
- [X] 61. fix transpile import path
- [X] 62. `fsc` should be able to detect and parse JSON.
- [X] 63. `fsc` should be able to output JSON or JS, depends on an extension. If `.json` then JSON, otherwise DJS serializer.
- [ ] 64. Implement IO as mutable
  ```ts
  type Io<S> = {
      readonly log: (s: S, msg: string) => void
  }
  ```
- [ ] 65. Investigate mutability inference
- [ ] 66. Only forward objects are visible. Example:
  ```ts
  const a = () => 5
  const b = () => a() + 7 // ok
  const c = b() // ok
  const d = d() // error!
  const e = () => e() // ok
  // two recursive functions:
  const f = () => h() // not ok
  const h = () => f() // ok
  // how to solve the two recursive functions case:
  const x = {
      a: () => x.b() // ok
      b: () => x.a() // ok
      c: () => x.rrrr() // ok
  }
  ```
- [ ] 67. BAST: Consider using only one parameter in functions. System functions should be converted into special BAST operators.
- [ ] [69-incremental.md](69-incremental.md).
- [ ] 70. Flags for `fsc`:
  1. `--tree`: a tree, no constants and references. It looks almost like JSON, except `export default`. This method is also used when the output file extension is `.json`.
  2. `--js`: always clone mutable objects. bigint and string can be deduplicated.
  3. `--fjs` (default behavior): deduplication of the same objects.
  4. `--ca`: content-addressable deduplication.
- [ ] 71. Make only one universal executable instead of `fsc` and `fst`. We can leave only `fsc`. Rename it to `fjs`?. Examples:
  - Compiling:
      - `fjs compile a.f.js` prints FunctionalScript code to stdout.
      - `fjs compile a.f.ts a.json` saves JSON.
      - `fjs compile a.json a.bast` saves BAST.
  - Testing:
      - `fjs test` recursively finds and tests all `test.f.ts` and `test.f.js` files (optionally `test.f.mts` and `test.f.mjs`).
- [ ] 72. A property could be a number, `{ 3e+7: true }`. Exception: no sign is allowed at the beginning (`+`, `-`).
- [x] [./74-bast-tag.md](./74-bast-tag.md)
- [ ] 75. Rewrite [./lang/2220-namespace-import.md](./lang/2220-namespace-import.md) to use `import type A from "x.js"`. FJS should just ignore this. It's a part of type stripping. Type stripping blockers:
  - Node.js (even 24) can't use `.ts` files from `./node-modules/`.
  - Node, Deno and TypeScript don't allow to use type annotations in `.js` files.
  - Browsers don't support type annotations and `.ts` files.
- [ ] 76. Serialization mapping should be done only once. For example, instead of
  ```rust
  fn serialize(v: bool) => u8 {
      if v == false { 0 } else { 1 }
  }
  fn deserialize(v: u8) -> bool {
      if v == 0 { false } else { true }
  }
  ```
  we should have something like this
  ```rust
  const BOOL_MAP: ... = [(false, 0), (true, 1)];
  ```
- [ ] 77. Support for [./lang/2330-property-accessor.md](./lang/2330-property-accessor.md).
  ```js
  const a = { b: 45, c: [3] }
  // Operator:
  // `instant_property(a, "b")`
  const c0 = a.b
  // Only strings are allowed excluding a list of specific strings. Operator:
  // `instant_property(a, "b")`
  const c1 = a["c"]
  // Operator:
  // `at(c1, +0)`
  const c2 = c1[+0] // [+...] is allowed.
  // translated into one operator:
  // `own_property(a, c2)`
  const c3 = Object.getOwnPropertyDescriptor(a, c2)?.value
  ```
- [ ] 78. Instant Method Call
  ```js
  // Operator:
  // `instant_method_call(a, "b", c)`
  const c4 = a.b(c)
  // Operator:
  // `instant_method_call(a, "b", c)`
  const c4 = a["b"](c)
  // Operator:
  // `at_call(a, b, c)`
  const c4 = a[+b](c)
  ```
- [ ] 79. Use `importmap` as `package-lock.json`. See https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap#integrity_metadata_map.
- [ ] 80. Add `CONST_REF` to serialization.

## Language Specification

See [lang/README.md](./lang/README.md).
