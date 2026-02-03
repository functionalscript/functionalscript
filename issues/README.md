# Issues

- [ ] [005-publish](./005-publish.md)
- [ ] 9. Generating a Website.
- [ ] 10. Short URL table.
- [ ] [011-fs-load](./011-fs-load.md)
- [ ] 13. Docs for JSR. See https://jsr.io/@functionalscript/functionalscript/score
- [ ] 16. License in JSR file?
- [ ] 18. Find a formatter for `.f.js` and `.f.ts` files.
- [ ] P5 20. Test framework should be able to run a subset of tests.
- [ ] [021-test-framework-silent-mode](./021-test-framework-silent-mode.md). Silent mode with light progress by default; use `--verbose` for full output.
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
- [ ] [031-formal-grammar](./031-formal-grammar.md).
- [ ] 032. implement a stupid, non-deterministic parser using [031-formal-grammar](./031-formal-grammar.md).
- [ ] 033. Rust: VM: implement `Any` and other types as wrappers
  ```rust
  struct Any<A: AnyPolicy>(A);
  ```
  This way we can implement operations on it, such as `+`.
- [ ] 36. Test framework for a browser. We should have an HTML file (e.g. `./dev/test.html`) that can be opened in a browser.
- [ ] 37. Language Design: Currently, FS has no way to store references (objects/functions) in a container with fast search capabilities. Several options:
  - add `Map` to the language
  - use content (serialization). This can be slow with non-CA VM. Functions are still hard to serialize.
- [ ] 38. Rust: bigint: Optimize multiplication https://www.youtube.com/watch?v=AMl6EJHfUWo
- [ ] [039-radix-encoding.md](./039-radix-encoding.md)
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
- [ ] [051-parser-structures.md](./051-parser-structures.md).
- [ ] [052-poker.md](./052-poker.md).
- [ ] [054-token-plus.md](./054-token-plus.md)
- [ ] 55. Add Carbon advertisements on a web site https://www.carbonads.net/
- [ ] 56. Translate the Byte Code into WebAssembly or other PLs, Rust/Zig/C/C++/LLVM.
- [ ] 57. https://github.com/Agoric/eslint-config-jessie
- [ ] 58. 1) There is a todo in line 259 of big_uint.rs, that issue should be clarified.
          2) Replace panic in BigUint::shl with returning an error code.
- [ ] 59. Hash table improvement https://arxiv.org/pdf/2501.02305
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
- [ ] [069-incremental.md](069-incremental.md).
- [ ] 70. Flags for `fsc`:
  1. `--tree`: a tree, no constants and references. It looks almost like JSON, except `export default`. This method is also used when the output file extension is `.json`.
  2. `--js`: always clone mutable objects. bigint and string can be deduplicated.
  3. `--fjs` (default behavior): deduplication of the same objects.
  4. `--ca`: content-addressable deduplication.
- [ ] 72. A property could be a number, `{ 3e+7: true }`. Exception: no sign is allowed at the beginning (`+`, `-`).
- [x] [./074-bast-tag.md](./074-bast-tag.md)
- [ ] 75. Rewrite [./lang/2220-namespace-import.md](./lang/2220-namespace-import.md) to use `import type A from "x.js"`. FJS should just ignore this. It's a part of type stripping. Type stripping blockers:
  - Node.js (even 24) can't use `.ts` files from `./node-modules/`.
  - Node, Deno and TypeScript don't allow to use type annotations in `.js` files. See the proposal.
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
- [ ] 81. Currently, `nanvm_lib` relies on traits, such as `Any`, `Object`, `Array`, and `String16`. The problem is that one type can implement multiple traits, for example, `struct A { ... }` can implement both `String16` and `Object` traits. It makes implementing generic operators, serialization, etc., challenging for the traits. We need concrete wrap types. For example, `struct Any<T: Vm>(T::Any);`. In this case, we can implement different operators and traits for the generic `Any<T>` type instead of a trait.
- [ ] [./082-nanvm.md](./082-nanvm.md).
- [ ] 83. FSC should support for `#` comments.
- [ ] 85. GitHub supports colors, so we should have, at least, three modes:
  - [ ] GitHub: colored log,
  - [ ] no GitHub, isTTY: colored progress bar,
  - [ ] no GitHub, no isTTY: non-colored log.
- [ ] 86. Operations for new VM impl:
  ```rust
  // not all types require to implement these traits.
  trait StringCoercion {
      // link to MDN, optionally to ECMAScript
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion
      fn string(self) -> String16
  }
  // not types required to implement.
  trait NumberCoercion {
      // link to MDN, optionally to ECMAScript
      fn unary_plus(self) -> Result<f64, Any>
  }
  // ```
  // fn some() -> Result<(), Any> {
  //     let x = a.unary_plus()?;
  //     // let y = (-a)? // `-` never throws so we don't need `?`.
  //     let y = -a;
  // }
  // ```
  trait Js: StringCoercion + NumberCoercion + Neg<Output = Any> {}

  impl Js for Any {}
  impl Js for Unpacked {}
  ```
- [ ] 87. Optimization. Reduce number of `Rc::clone()`:
  - Now:
    ```rust
    type Any = Rc<AnyImpl>;
    fn add(a: Any, b: Any) -> Any;
    // alternative:
    fn add(a: &Any, b: &Any) -> Any;
    ```
  - Proposal:
    ```rust
    trait AnyImpl {
        fn clone_to_any(&self) -> Any;
    }
    trait Any: Deref<AnyImpl>;
    fn add<'a>(a: &'a AnyImpl, b: &'a AnyImpl) -> Any {
        return { a: a.clone_to_any() };
    }
    let x: Any = ...;
    let y: Any = ...;
    let xy = add(*x, *y);
    let x2 = add(*x, *x);
    ```
- [ ] [088-python.md](088-python.md).
- [ ] 89. Rust Unpack dispatch:
  ```rust
  trait Unary<Tag> {
      type Result;
      fn do(self) -> Self::Result;
  }

  struct UnaryPlus;
  impl Unary<UnaryPlus> for f64 {
      type Result = Any;
      fn do(self) -> Self::Result;
  }

  impl<Operation> Unary<Operation> Unpack {
      type Result = Any;
      fn do(self) -> Self::Result {
          match ... {
              Number(v) => v.do::<Operation>(),
              ...
          }
      }
  }
  ```
- [X] 90. Change npm publishing. See https://docs.npmjs.com/trusted-publishers
- [ ] 91. Create a separate nominal type for UTF-8.
- [ ] 92. Create a separate nominal types for MSB and LSB bit vectors.
- [ ] 95. Move some CI tasks to Docker. For example, testing on old Node versions.
- [ ] 96. CI caching.
- [ ] 97. Smart CA CI for FunctionalScript.
- [ ] 101. Monad's IO design.
- [X] 111. Fix `npm` publishing.
- [ ] 112. CAS
- [ ] 113. Create an ECMAScript proposal for `BigInt.bitLen()`
- [ ] 114. A generic command line parse that can produce help.
- [ ] 115. Run-time types. See also https://arktype.io/
  1. We need more powerful type system than TS. See `bnf` or `effects`.
  2. Validating type match at run-time.

## Language Specification

See [lang/README.md](./lang/README.md).
