# Issues

- [ ] [005-publish](./005-publish.md)
- [ ] 9. Generating a Website.
  - [X] 1. A minimal webpage
  - [X] 2. Generate Deno and Rust docs and publish them.
  - [ ] 3. Convert `README.md` files into HTML and publish them.
  - [ ] 4. Source code highlighting.
  - [ ] 5. One `main.css`
  - [ ] 6. Convention for `page.f.ts`. The `page.f.ts` generates a demo webpage that demonstrates the functionality of the module `module.f.ts` located in the same directory.
  - [ ] 7. In the browser test runner (we need to switch our test framework to Effects first).
- [ ] 10. Short URL table.
- [ ] [011-fs-load](./011-fs-load.md)
- [ ] 13. Docs for JSR. See https://jsr.io/@functionalscript/functionalscript/score
- [ ] 18. Find a formatter for `.f.js` and `.f.ts` files.
- [ ] P5 20. The test framework should be able to run a subset of tests.
- [ ] [021-test-framework-silent-mode](./021-test-framework-silent-mode.md). Silent mode with light progress by default; use `--verbose` for full output. Blocked by 139.
- [ ] 23. a console program similar to one that we have in the NaNVM repo.
- [ ] P5 24. Create `./fsc.ts` that supports the same behavior as the current NaNVM Rust implementation:
    - [ ] run `node ./fsc.ts input.f.js output.f.js`
    - [ ] run `deno ./fsc.ts input.f.js output.f.js`
- [ ] 28. Make a distinction between unit tests, examples, and API tests.
    - Unit tests are completely deterministic. They run every time the module is loaded, so they must be very, very simple and check basic hypotheses. They are not available as a public interface.
      ```ts
      import { assert } from 'dev/module.f.ts'
      assert(2 + 2 === 4)
      ```
    - Examples use only public API and are located in `*example.f.ts` files.
    - API tests use only public API and are located in `*test.f.ts` files.
- [ ] 29. Test in a browser. It's important for such browsers as Firefox because we don't have SpiderMonkey as a CLI.
- [ ] [031-formal-grammar](./031-formal-grammar.md).
- [ ] 032. Implement a stupid, non-deterministic parser using [031-formal-grammar](./031-formal-grammar.md).
- [ ] 033. Rust: VM: implement `Any` and other types as wrappers
  ```rust
  struct Any<A: AnyPolicy>(A);
  ```
  This way we can implement operations on it, such as `+`.
- [ ] 36. Test framework for a browser. We should have an HTML file (e.g., `./dev/test.html`) that can be opened in a browser.
- [ ] 37. Language Design: Currently, FS has no way to store references (objects/functions) in a container with fast search capabilities. Several options:
  - add `Map` to the language
  - use content (serialization). This can be slow with a non-CA VM. Functions are still hard to serialize.
- [ ] 38. Rust: bigint: Optimize multiplication https://www.youtube.com/watch?v=AMl6EJHfUWo
- [ ] [039-radix-encoding.md](./039-radix-encoding.md)
- [ ] P5 40. TypeScript doesn't show an error if an exported type references a non-exported type. We need to find a way to detect such cases.

  ```ts
  type A = number
  export type B = A | string
  ```

  Notes:
  - FunctionalScript doesn't have RegEx, so an ad-hoc text-scan implementation in `.f.ts` is not possible.
  - The task is more about an external tool: it requires emitting `.d.ts` via `tsc` and inspecting the output (or driving the TypeScript Compiler API), neither of which belongs inside a FunctionalScript module.
  - The proper place for this check is a FunctionalScript parser, which is not available yet.
  - Low priority (P5).
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
- [ ] 47. The FunctionalScript Compiler should be able to load and run modules as a meta-programming option. When it fails, it should show a good error message similar to a compile-time error.
- [ ] 48. One day, we should switch back to the `.js` extension if [Type Annotation Proposal](https://github.com/tc39/proposal-type-annotations) is included in ECMAScript.
- [ ] [051-parser-structures.md](./051-parser-structures.md).
- [ ] [052-poker.md](./052-poker.md).
- [ ] [054-token-plus.md](./054-token-plus.md)
- [ ] 55. Add Carbon advertisements on a website https://www.carbonads.net/
- [ ] 56. Translate the Byte Code into WebAssembly or other PLs, Rust/Zig/C/C++/LLVM.
- [ ] 57. https://github.com/Agoric/eslint-config-jessie
- [ ] 58. 1) There is a todo in line 259 of big_uint.rs; that issue should be clarified.
          2) Replace panic in BigUint::shl with returning an error code.
- [ ] 59. Hash table improvement https://arxiv.org/pdf/2501.02305
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
  - Node, Deno, and TypeScript don't allow the use of type annotations in `.js` files. See the proposal.
  - Browsers don't support type annotations and `.ts` files.
- [ ] 76. Serialization mapping should be done only once. For example, instead of
  ```rust
  fn serialize(v: bool) => u8 {
      if v == false { 0 } else { 1 }
  }
  fn deserialize(v: u8) => bool {
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
  // `instant_property(a, "c")`
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
- [ ] 81. Currently, `nanvm_lib` relies on traits, such as `Any`, `Object`, `Array`, and `String16`. The problem is that one type can implement multiple traits; for example, `struct A { ... }` can implement both `String16` and `Object` traits. It makes implementing generic operators, serialization, etc., challenging for the traits. We need concrete wrap types. For example, `struct Any<T: Vm>(T::Any);`. In this case, we can implement different operators and traits for the generic `Any<T>` type instead of a trait.
- [ ] [./082-nanvm.md](./082-nanvm.md).
- [ ] 83. FSC should support `#` comments.
- [ ] 85. GitHub supports colors, so we should have at least three modes:
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
- [ ] 92. Create a separate nominal type for MSB and LSB bit vectors.
- [ ] 95. Move some CI tasks to Docker. For example, testing on old Node versions and Playwright.
- [ ] 96. CI caching.
- [ ] 97. Smart CA CI for FunctionalScript.
- [ ] 112. CAS
- [ ] 113. Create an ECMAScript proposal for `BigInt.bitLen()`
- [ ] 114. A generic command line parser that can produce help.
- [ ] 116. Report the TSGO regression (see `btree`).
- [ ] 118.
  - [X] Create example repository: https://github.com/functionalscript/file-server-example.
  - [ ] use it in CI.
- [ ] 122. Consider adding a new file type for applications. For example, `node.f.ts` or `app.f.ts`.
      These files should have `export default` with type `NodeProgram`.
      Then we may have other application files, for example, `web.f.ts`.
- [ ] 123. `tsgo` asks for `"types": ["node"]` in the [../tsconfig.json](../tsconfig.json). It looks like a regression to me because we've installed `@types/node` as `devDependencies`.
- [ ] 124. `RequestListener` should not be stateless. Options:
  1. One option is to pass a state.
  2. In-memory KeyValue storage with access using effects.
  3. One function for all events that also pass a state, similar to a `scan` function.
- [ ] 125. `bun test` doesn't handle returned functions as tests.
  1. Create a test file `integration/test.f.ts` and rename it to something like `integration/uncomment-test.f.ts`. The file should be renamed back when we need to test an engine.
  2. The file should contain multiple tests using objects, arrays, and functions. At least one function should produce a similar structure.
  3. At least one function should be `throw`.
- [ ] [130-or-optimization](./130-or-optimization.md). **Superseded by 143.** Canonical-form properties of `or` are now properties of the data form by construction; nothing to do on the thunk form.
- [ ] 131. An allocator for `nanvm` that doesn't panic. Instead, it should return `Result<T, Any`.
- [ ] 132. `exec`:
  - 1. Keep most implementation code in `module.f.ts` instead of `module.ts`
  - 2. Use async functions and await instead of `.then`
- [ ] 134. A proposal for nominal types in TypeScript. The main reason is that the current `Nominal` type doesn't support type narrowing properly.
- [ ] 136. CI should have all tools and image versions in a specific file. This file is a kind of `lock` file for the CI. The lock file will be periodically updated. We will also need instructions on how to check the newest tool version in `README.md`.
- [ ] 138. Implement a script that will update the lock file by reading the latest versions of tools from the internet using the instructions from 136.
- [ ] 139. Translate the test framework (`dev/tf/module.f.ts`) to Effects. See [148-test-framework-effects](./148-test-framework-effects.md) for the detailed design.
- [ ] 140. We should have 100% test coverage for all `module.f.ts` files.
- [ ] 141. Design for a universal, extensible type system based on custom RTTI. How it should work:
  1. We should define an interface for type validation. For example
     ```ts
     type TypeSystem<T> = (a: T) => {
         equal: (b: T) => boolean
         subset: (sub: T) => boolean
         // ...
     }
     type Info<T, S extends TypeSystem<S>> = T // this type will be used by other parsers to detect `typeof S`. TypeScript will see only `T`.
     ```
  2. A user defines a data type and an implementation for the interface for type validations. For example:
     ```ts
     const type = null | undefined | ... as const
     const system: TypeSystem<typeof type> = {
         ...
     }
     type Map<T> = ...
     type Ts<T> = Info<Map<T>, typeof system> // always like this `Info<..., typeof ...>`!
     ```
  4. A parser recognizes only a few constructions, for example:
     ```ts
     const t = null as const
     const a: Ts<typeof t> = ...
     ```
- [ ] [143-rtti-data](./143-rtti-data.md). Serializable data representation for RTTI `Type`, modeled after `fs/bnf/data/`. Two forms with one job each — thunks for ergonomic construction, data for all algebra (union, subset, canonical form, dispatch). Supersedes 130.
- [ ] 144. TypeScript proposal: distinguish prototype member functions (which require `this`) from free functions. For example, `Array.push` can only be called as `array.push(5)` — detaching it with `const p = array.push; p(5)` is a runtime error because `this` is lost. TypeScript currently types both forms identically and does not prevent the detached call. The proposal is for TypeScript to track whether a function captures `this`, and reject uses where `this` would be unbound.
- [ ] 145. Use Docker containers for Linux CI jobs. Running Linux jobs inside a Docker container allows GitHub Actions to cache the container image, so tool installation (Node, Rust, Bun, Deno, Wasmer, Wasmtime, etc.) is paid once per image rebuild rather than on every CI run. The cache key must include all tool versions and the target architecture. macOS and Windows jobs are unaffected.
- [ ] [146-rtti-ts-inference](./146-rtti-ts-inference.md). `Ts<T>` walks schema structure on every query, which overflows TS's depth budget for `Ts<any>` and forces `as any` casts in `validate`/`parse`. Compares Zod/Valibot/ArkType approaches and sketches the design space.
- [ ] 147. Deno slow-types: Deno's JSR publisher requires full explicit type annotations on exported `const`. For complex schemas defined with `as const`, writing out the full type is impractical. A fix via `satisfies` is proposed in [deno_graph#639](https://github.com/denoland/deno_graph/pull/639) and is available in deno_graph 0.107.2, but Deno 2.7.14 still ships deno_graph 0.107.1. Until a Deno release includes deno_graph 0.107.2, add `--allow-slow-types` to the `deno publish` and `deno publish --dry-run` commands. Remove `--allow-slow-types` once the required Deno version is available.
- [ ] [148-test-framework-effects](./148-test-framework-effects.md). Redesign the test framework (`dev/tf/module.f.ts`) as an Effect program, replacing the hand-rolled `Input<T>` threading and `Io` dependency. Unblocks browser testing (i29, i36), silent mode (i21), and subset runs (i20).
- [ ] [149-sandbox](./149-sandbox.md). `Sandbox` effect: runs a plain sync function with try/catch and timing in one atomic operation; future fields for memory/stack limits; worker-based implementations enforce hard limits.


## Language Specification

See [lang/README.md](./lang/README.md).
