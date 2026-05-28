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
- [ ] 125. `bun test` doesn't handle returned functions as tests. See also [i155](./155-test-runner-integration.md) and [i183](./183-tf-framework-scenario-tests.md), which replace the manual rename approach proposed here with an automated scenario matrix.
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
- [ ] 147. Deno slow-types: Deno's JSR publisher requires full explicit type annotations on exported `const`. For complex schemas defined with `as const`, writing out the full type is impractical. A fix via `satisfies` is proposed in [deno_graph#639](https://github.com/denoland/deno_graph/pull/639) and is available in deno_graph 0.107.2, but the fix doesn't work when the constant is used in `export type` as `typeof`. Deno 2.8.0 ships deno_graph 0.108.2 but the issue persists. Keep `--allow-slow-types` flag on `deno publish` and `deno publish --dry-run` commands until this is fully resolved.
- [x] [148-test-framework-effects](./148-test-framework-effects.md). Redesign the test framework (`dev/tf/module.f.ts`) as an Effect program, replacing the hand-rolled `Input<T>` threading and `Io` dependency. Unblocks browser testing (i29, i36), silent mode (i21), and subset runs (i20).
- [x] [149-sandbox](./149-sandbox.md). `Sandbox` effect: runs a plain sync function with try/catch and timing in one atomic operation; future fields for memory/stack limits; worker-based implementations enforce hard limits.
- [ ] [150-tty](./150-tty.md). `IsTty` effect: reports whether a file descriptor is connected to a terminal; used by the test framework to gate ANSI color output.
- [x] [151-transpiler-effects](./151-transpiler-effects.md). Convert DJS transpiler (`fs/djs/transpiler/module.f.ts`) from legacy `Fs`/`readFileSync` to `ReadFile` effect; update tests to use the virtual effect runner instead of `createVirtualIo`. Unblocks deletion of `fs/io/virtual/module.f.ts`.
- [X] [152-write-effect](./152-write-effect.md). `Write` effect and TTY-aware console: `write(stream, data)` with `WriteConsoles = 'stdout' | 'stderr'`; `csiWrite` wrapper reads `isTTY` from `NodeProgramOptions.std`; supersedes i150.
- [X] [153-write-queue](./153-write-queue.md). Async write with backpressure: use `stream.write()` + `once(stream, 'drain')` for atomic, backpressure-aware writes to `stdout`/`stderr`.
- [x] [154-parseset-throws](./154-parseset-throws.md). `parseTestSet`: eliminate double `sandbox` call for throw-tests; return `TestEntry = { fn, throws }` instead of a wrapper function; discriminate from the array branch via `Array.isArray`.
- [ ] [155-test-runner-integration](./155-test-runner-integration.md). Three problems: (1) `module.f.ts` and `module.ts` duplicate the test-tree walk; (2) `isGitHub` branching hardcodes a CI environment inside the walker; (3) Bun silently drops dynamically-registered subtests — fix by running generated sub-trees inline.
- [x] [156-tf-virtual-tests](./156-tf-virtual-tests.md). Test the `dev/tf` runner itself: virtual test files via an `import`-dictionary lookup, test functions that return `SandboxResult` directly (deterministic, no clock), a capture reporter that records structured events. Covers walker, path formatting, throw semantics, return-value sub-trees, summary counts.
- [ ] [157-json-djs-shared-core](./157-json-djs-shared-core.md). DRY: DJS is a superset of JSON, yet the parser value-state machine, the recursive serializer walker (3 copies), and the tokenizer minus-rewriter are each forked between `fs/json` and `fs/djs`. Extract a shared value-parser factory, a `serializeValue` factory, and a `negateOnMinus` scan factory.
- [ ] [159-nanvm-trait-boilerplate](./159-nanvm-trait-boilerplate.md). DRY (Rust): the VM wrapper newtypes repeat near-identical `Serializable`/`SizedIndex`/`Index`/`PartialEq` impls across `string`/`array`/`object`/`bigint`/`function`; collapse them with a `container_traits!` macro. Also: macro the primitive `Serializable`/`Le` impls, and merge `obj`/`arr`/`fn_to_primitive` into one generic helper.
- [ ] [160-nibble-set-dead-or-factory](./160-nibble-set-dead-or-factory.md). DRY: `nibble_set` duplicates `byte_set`'s bitmask algebra but has zero consumers. Default recommendation: delete the dead module. Alternative (only if a nibble consumer is planned): extract a `bitSet` factory parameterized over the numeric domain.
- [ ] [161-keyed-btree-collection](./161-keyed-btree-collection.md). DRY/architecture: `string_set` and `ordered_map` are parallel thin wrappers over the same string-keyed B-tree. Propose a shared `keyedCollection(keyOf, keyCmp)` core, making explicit that a set is a map whose key is its value.
- [x] [162-rtti-parse-container-factories](./162-rtti-parse-container-factories.md). DRY: `rtti/validate` factors its array/record and tuple/struct handlers into two factories, but `rtti/parse` hand-writes all four. Mirror the factory pair in `parse` (with a `rebuild` callback for the transformed output).
- [ ] [163-reporter-test-method](./163-reporter-test-method.md). Add `test(throws, f)` to `Reporter<O>` so the walker delegates test execution to the reporter; removes the hardcoded `Sandbox` dependency from `runModule` and enables `module.ts` to reuse the Effects walker without its own scan loop.
- [ ] [164-uncurry-accumulators](./164-uncurry-accumulators.md). P5. Generalize the `StateScan` uncurry refactor (763) to the other state-threading accumulator types: `Fold`/`Reduce` and `sorted_list`'s `ReduceOp`/`TailReduce` still curry their data parameters, inviting per-element/accumulator closures that are meaningless to cache and a state-leak hazard. Uncurry to `(input, acc) => …`; keep `Binary`/`Equal`/`Unary` curried.
- [ ] [165-layered-parser](./165-layered-parser.md). Layered parser: a BNF-driven tokenizer maps code-points (plus file/position meta) to single-symbol tokens (`s`, `n`, `i`, …) carrying value/position as meta information, feeding a second BNF parser layer. Open questions: keyword disambiguation, meta-info propagation through reductions, unified error representation across layers.
- [ ] [166-capture-reporter-immutable](./166-capture-reporter-immutable.md). `dev/tf/test.f.ts`: replace the mutable `events.push(...)` array in `makeReporter` with an immutable `Capture` effect accumulated into virtual `State`, consistent with the no-mutation rule.
- [x] [167-bit-vec-msb-concat](./167-bit-vec-msb-concat.md). DRY: four modules (`crypto/sign`, `asn.1`, `sul/id`, `sul/level/literal`) each re-bind the identical `listToVec(msb)` under a different local name. Export the bound `msbConcat` from `bit_vec` so consumers import it instead of re-deriving.
- [ ] [168-utf-codepoint-decoder](./168-utf-codepoint-decoder.md). DRY: `utf8` and `utf16` share a byte-for-byte streaming decoder skeleton (`eofList = [null]`, the unit-vs-EOF scan op, and `toCodePointList = flat(stateScan(op)(null)(flat([input, eofList])))`) plus a duplicated `errorMask`. Extract a `decoder(byteOp, eofOp, init)` factory and move `errorMask` to a shared code-point module.
- [ ] [169-map-list-iterable](./169-map-list-iterable.md). Clarity/reuse: `types/map`'s private `concat`/`filter` generators are the only hand-rolled iterables outside `list`. Either drop them for `new Map([...m, e])` / `new Map([...m].filter(...))`, or share an `Iterable`-level layer once a second consumer exists.
- [ ] [170-ci-tool-steps](./170-ci-tool-steps.md).
- [ ] [171-tf-fn-name-throw](./171-tf-fn-name-throw.md). Remove `fn.name === 'throw'` from `parseTestSet`; throw semantics should be determined solely by the property key, not by engine-inferred function names. DRY: `ci/bun`, `ci/deno`, and `ci/node` repeat the same `clean([install(setup), ...test(cmd), ...extra])` shape. Extract a `toolSteps(setup, cmds)` builder in `ci/common`, with the install step passed in to accommodate bun's per-OS variant.
- [ ] [172-rtti-validate-parse-skeleton](./172-rtti-validate-parse-skeleton.md). Investigate collapsing the parallel `validate`/`parse` container factories into one shared skeleton in `common` with an injected `build` callback (identity for `validate`, `rebuild` for `parse`). Catch: `validate`'s no-allocation/short-circuit contract vs `parse`'s map-all/rebuild. Defer until a third consumer (i143 data form) exists.
- [ ] [173-csi-edsl](./173-csi-edsl.md). Introduce a structured eDSL for composing ANSI CSI/SGR sequences in `fs/text/sgr/module.f.ts`, analogous to the HTML eDSL in `fs/html/module.f.ts`. A `Block = readonly [Options, readonly (string | Block)[]]` tree replaces hand-rolled template-literal concatenation.
- [ ] [174-range-map-lexer](./174-range-map-lexer.md). DRY: `fsc` and `js/tokenizer` are the only two code-point scanners and both hand-roll the same range-map Mealy machine — identical `union` conflict rule, `range_map.merge` wrapper, range/range-set cell combinators, and `v => c => x(c)(i)(v)(c)` dispatch — differing only in the continuation payload. Extract a `lexer(def)` factory parameterized over the state continuation.
- [ ] [175-ci-setup-tool](./175-ci-setup-tool.md). DRY: five CI modules build `install({ uses, with: { '<x>-version': version } })` by hand (node/deno/bun/wasmtime/wasmer). Extract a `setupTool(uses, versionKey)(version)` factory in `ci/common`; complements i170/i171, which take the install step as a pre-built input.
- [ ] [176-json-file-effects](./176-json-file-effects.md). DRY/separation: `dev`, `dev/version`, and `ci` each open-code "read+utf8-decode+JSON.parse a file" and "JSON.stringify(pretty)+utf8+write a file" over the effect API. Extract `readJsonFile`/`writeJsonFile` helpers (read: 2 consumers, write: 3).
- [ ] [177-bigfloat-normalize-mantissa](./177-bigfloat-normalize-mantissa.md). DRY: `bigfloat`'s `increaseMantissa`/`decreaseMantissa` are an exact mirror (same zero guard, sign split, shift-and-adjust loop); collapse into one private `normalizeMantissa(shift, de, done)` factory.
- [ ] [178-cbase32-bit-vec-padding](./178-cbase32-bit-vec-padding.md). Separation: `cbase32` inlines a 1-then-0s bit-padding scheme and a trailing-zero strip loop (the latter already flagged `// TODO`). Move `padToMultiple`/`unpadMultiple` into `bit_vec`; SHA-2's padding is deliberately *not* a match.
- [x] [179-btree-collapse-root](./179-btree-collapse-root.md). DRY: `btree/set` and `btree/remove` both end with `x.length === 1 ? x[0] : x` to demote a single-child root. Name it `collapseRoot` in `btree/types` (2 consumers).
- [ ] [180-sorted-set-intersect-symmetry](./180-sorted-set-intersect-symmetry.md). Separation: `sorted_set.union` delegates to `sorted_list.merge`, but `sorted_set` defines the `intersect` engine itself. Move `intersectMerge`/`intersectReduce` into `sorted_list` as an exported `intersect`, restoring symmetry; optionally name the trivial `dropTail` reducer.
- [ ] [182-batch-load-effects](./182-batch-load-effects.md). Introduce computational collections in effects: a `flatMap` combinator (ALIQ-style) lets a runner batch independent sub-effects instead of sequencing them. Related but separate: make `all` accept a lazy `List` from `fs/types/list`.
- [ ] [183-tf-framework-scenario-tests](./183-tf-framework-scenario-tests.md). Scenario-based conformance tests for the Node/Deno/Bun/Playwright framework bridges: minimal `*.test.f.ts` files in `fs/dev/tf/scenarios/` covering pass, fail, return-value sub-trees, and throw — run per-framework via a script that checks exit code against a manifest of expected outcomes. References i155 (Bun subtest breakage).
- [ ] [184-min-max-comparable](./184-min-max-comparable.md). DRY: the `a < b ? a : b` / `a < b ? b : a` min/max algorithm is written out in both `function/operator` (for `number`) and `bigint`, each with real consumers (`number`, `bit_vec`/`asn.1`). Define a single generic `min`/`max` in `function/compare` with the same `Cmp1`/`Cmp2`-guarded signature as `cmp` (so `min(1)("a")` is rejected; body likely reuses `cmp`), and retire the per-type copies.
- [ ] [185-byte-set-bigint-mask](./185-byte-set-bigint-mask.md). DRY/separation: `byte_set.range` re-derives `bigint.mask`'s `(1n << len) - 1n` via `one(k) - 1n`. Import `mask` and write `range = ([b, e]) => mask(BigInt(e - b + 1)) << BigInt(b)`; behavior-preserving.
- [ ] [186-sul-id-fromv8-reuse](./186-sul-id-fromv8-reuse.md). DRY: `sul/id.hashMerge` hand-rolls `uint(listToVec(msb)(v8.map(vec(0x20n))))` to pack a SHA-2 `V8` into a bigint, but `sha2` already exports `base32.fromV8` for exactly that MSB packing. Reuse it and drop the `vec`/`listToVec`/`uint` imports kept only for that line.
- [ ] [187-byte-rounding-divup](./187-byte-rounding-divup.md). Perf-aware DRY + type-honesty: `asn.1` rounds bit-lengths to bytes with shifts (`>> 3n`/`<< 3n`); reusing `bigint.divUp(8n)` would swap a shift for a general `/`. Add a shift-based power-of-two `divUpE2(exp)`/`roundUpE2(exp)` (reusing `mask`), consumed by `asn.1` and `crypto/sign` (8 = 2³). Keep the general `divUp`/`roundUp` for `bit_vec`'s non-power-of-two divisor, and retype both from `Reduce` to `(b) => Unary`.
- [ ] [188-nullable-from-undefined](./188-nullable-from-undefined.md). DRY: `array.at` and `object.at` both normalize `undefined → null` inline. Add `nullable.fromUndefined` (its natural home, alongside `Nullable`/`map`/`toOption`) and consume it in both.
- [ ] [189-asn1-decode-all-unfold](./189-asn1-decode-all-unfold.md). DRY: `asn.1`'s `decodeObjectIdentifier` and `decodeSequence` both loop `apply step until length === 0n, collecting items`, differing only in the step. Extract a generic `decodeAll(step)` unfold (candidate for a lazy `List` build to shed the `[...result, x]` quadratic spread).
- [ ] [190-text-char-code-boundary](./190-text-char-code-boundary.md). Separation/DRY: single code-unit/code-point ↔ string conversion is a `fs/text` concern, yet `html`, `fsc`, and `js/tokenizer` each re-bind `String.fromCharCode` (and `bnf` re-binds `fromCodePoint`, `ascii` reaches into `codePointAt`). Expose single-character converters from `fs/text` and import them.
- [ ] [191-bigfloat-with-sign](./191-bigfloat-with-sign.md). DRY: `bigfloat`'s `round53` and `decToBin` both strip the sign (`abs(m)`/`BigInt(sign(m))`), do unsigned work, and re-apply via `multiply(...)(s)`. Factor a private `withSign(m, e)(f)` magnitude envelope. Distinct from i177 (which pairs the mantissa shift loops).
- [ ] [192-error-exit-effect](./192-error-exit-effect.md). DRY: `cas` (local `e`) and `fjs` (three inline sites) both encode `error(s).step(() => pure(1))`. Lift an `errorExit(s)` helper into `types/effects/node` next to `error`/`pure`.
- [ ] [193-btree-path-fold-engine](./193-btree-path-fold-engine.md). Investigate: `btree/set` and `btree/remove` both end with `fold(<rebuild parent at PathItem index 0|2|4>)` over a `Path<T>` plus the i179 root collapse. Extract a shared `foldPath` scaffold parameterized by the three slot handlers — but the accumulator types and `Branch5` splitting differ, so confirm the unified signature needs no `as` cast first.
- [ ] [194-test-effects](./194-test-effects.md)
- [ ] 195. Improve `listToVec` from `bit_vec` by changing concatenation order. Instead of
  `(((((a + b) + c) + d) + e) + f)` which can be very slow for huge bigint, we can do
  `(((a + b) + (c + d)) + (e + f))`. The number of operations that works with huge bigints is much smaller, $O(n)$ vs $O(\log n)$. We will still use the `fold` operation, but it will accumulate a binary tree branch. We can make this algorithm generic.
- [ ] [196-djs-parser-trivia-handler](./196-djs-parser-trivia-handler.md). DRY: `djs/parser` defines 17 token-kind handlers that almost all repeat the same `case 'ws'/'nl'/'//'/'/*' → return state` trivia skip plus the `'eof'`/`default` unexpected-end/unexpected-token error returns (~69 trivia cases, ~33 error returns in one file). Lift a `wrap(core)` decorator that adds the three boilerplate branches around a grammar-relevant core handler. JSON-side parser is unaffected; complements i157 (which extracts the value-state machine itself).
- [ ] [197-djs-unknown-walker](./197-djs-unknown-walker.md). DRY: the DJS `Unknown` ADT is traversed by five independent `typeof`-dispatch walkers — three in `djs/serializer` (`serializeWithoutConst.f`, `serializeWithConst.f`, plus `countRefsOp`/`getConstantsOp`) and one in `djs/ast` (`toDjs`). Extract a `Visitor<R>`-based `walk` for `Unknown` mirroring `rtti/common/visit`. Extends i157 §2 (which covers only the serializer walker trio) to the ref-bookkeeping ops and the AST evaluator.
- [ ] [198-utf8-file-effects](./198-utf8-file-effects.md). DRY/separation: 3 read-side consumers and 4 write-side consumers (`dev`, `dev/version`, `ci`, `djs`, `djs/transpiler`) each open-code the `readFile → unwrap → utf8ToString` and `utf8 → writeFile` sandwiches. Lift `readUtf8File`/`writeUtf8File` next to the byte-level effects; sits one layer below i176 and unblocks the non-JSON UTF-8 consumers too.
- [ ] [199-dev-entry-cmp](./199-dev-entry-cmp.md). Separation: `fs/dev/module.f.ts` defines a local `cmp = ([a], [b]) => a < b ? -1 : a > b ? 1 : 0` to sort `Entry<unknown>` by key, duplicating `fs/types/string.cmp`. Replace with the existing comparator and drop the now-unused `Sign` import.
- [ ] [200-register-module](./200-register-module.md). Design and implement `registerModule` + `Register<O>` as a parallel path to `runModule`/`Reporter<O>` for external frameworks (Node, Bun, Playwright). Core difference: `registerModule` sandboxes `fn()` + sub-tree discovery together (the full framework test callback), while `runModule` sandboxes only the leaf call. Resolves the walk duplication in `module.ts` (i155 §1).

## Language Specification

See [lang/README.md](./lang/README.md).
