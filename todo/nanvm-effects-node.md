## Implement the native effect runner

**Priority:** P2
**Status:** open

### Problem

AOT-compiled FJS needs a native implementation of the effects it performs. The
Node runner is host JavaScript and cannot be compiled as FJS. Language logic
should stay in FJS so the handwritten Rust boundary remains small.

### Proposal

Implement the `nanvm-effects-node` library crate described by the
[roadmap](../nanvm-lib/todo/mvp-roadmap.md#effects-the-nanvm-effects-node-runner-crate-decided).
Keep `nanvm-lib` pure; the native executable depends on the VM, this runner
and generated FJS code. For operations whose request and result types fit
the existing RTTI vocabulary, define their data schemas and derive the Rust
stub, with a handwritten implementation of the generated trait. Keep the
TypeScript declarations handwritten and check them against the schemas;
preserving their nominal types is a separate gate below. Commit generated
output under `npm run gen`.

Begin with the synchronous operations the compiled program needs: file
reading/resolution/writing, console I/O and `sandbox`. The FJS loader owns
parsing, linking and interpretation; none belongs in a native `import` handler.
Do not add a `function` effect or a Rust EDAG dependency for this workflow.
Audit the existing vocabulary's consumers when selecting the supported subset;
this plan does not remove the host `import` effect from existing runners.

`sandbox` invokes a VM computation and captures its returned value or language
throw using the current `Result` contract. Preserve
[`SandboxResult`](../fjs/effects/common/types.ts), including duration. Replacing
`Result` with Rust panics is a separate design decision. Capturing an error does
not supply time limits, memory limits or process isolation; those remain
separate work. Async operations and their runtime are deferred until needed.

### Schema boundary

`sandbox` is exempt from RTTI derivation. Its existing generic
[`Sandbox`](../fjs/effects/common/types.ts) signature relates a callable thunk
to its result, while [RTTI `Type`](../fjs/rtti/types.ts) describes DataJS values.
An RTTI descriptor being a thunk does not make it a schema for callable values;
RTTI `unknown` excludes functions. Neither the callback nor the full
`SandboxResult<T>` contract can be represented by that vocabulary.

Keep the TypeScript declaration and the corresponding native operation
declaration handwritten. The native synchronous handler receives a callable VM
value, invokes it with no arguments through the VM call API, and records its
`Result<Any<A>, Any<A>>` and duration. The callback and its returned or thrown
values remain runtime VM values, including functions; they are not serialized
or validated as DataJS. This leaves the existing host generic/`Awaited<T>`
contract intact and does not introduce an RTTI callable extension.

Compose this handwritten operation with the generated operations in the runner.
The generated trait checks coverage only for its generated subset; conformance
tests must cover the handwritten boundary and its dispatch too. Audit each
additional operation for callbacks, generic relationships or runtime handles
before including it in schema generation. Native declaration and dispatch
details remain implementation work under this contract.

### Audit

Every member of `NodeOp` ([`fjs/effects/node/types.ts`](../fjs/effects/node/types.ts))
against the RTTI vocabulary ([`fjs/rtti`](../fjs/rtti/README.md)). Three facts
settle most rows. A result is a `Result`, which RTTI spells as the tuple union
`['ok', T] | ['error', E]`; the error channels, `IoChannel` and
`NotImplemented`, are tuples of a tag and a `string` or a struct of strings, so
they are data too. `Vec` is a nominal `bigint`: RTTI describes the underlying
`bigint`, but does not validate its brand. A trailing
optional parameter (`mkdir`'s `options?`, `exec`'s `stdin?`) is a tuple element
`or(option, t, undefined)`. `option` admits absence; the literal `undefined`
admits a present value. Both are needed: `do_` preserves the second argument
in `mkdir(path, undefined)` and `exec(command, undefined)`.

| Class | Operations | Why |
| --- | --- | --- |
| **Generated** (data in, data out): compiler I/O plus console input | `readFile`, `writeFile`, `writeBytes`, `mkdir`, `readdir`, `resolveFileModule`, `rm`, `write` (`stdout`/`stderr`), `read` (`stdin`) | every parameter and result is a `string`, `number`, `boolean`, `null`, `Vec`, a struct of those (`Dirent`, `FileModule`, `MakeDirectoryOptions`, `ReaddirOptions`) or an array of them. [`_CompileOp`](../fjs/compiler/types.ts) uses this row except `read`, plus handwritten `all`. This todo selects `read` separately for console input; `compile` does not use it. |
| **Generated**, outside the initial subset | `rmdir`, `rename`, `readBytes`, `readWhole`, `access`, `stat`, `createExclusive`, `writeExclusive`, `exec`, `inflate`, `now`, `randomInt` | the same shapes (`readWhole` and `writeExclusive` carry `readonly Vec[]`). Generated with the first group only when something the CLI or a proof fixture runs needs them; the stub is cheap to extend, an unimplemented trait method is not. |
| **Handwritten**: callbacks or generic values | `sandbox`, `catch` | a thunk in, an arbitrary VM value or throw out, as [Schema boundary](#schema-boundary) says. `catch` has the same shape as `sandbox` without the duration and goes with it. |
| **Handwritten**: effects or arbitrary values as data | `all`, `memCreate`, `memRead`, `memWrite` | `all` takes effects, which are thunks and `Do` nodes; the memory operations store and return any value (`<T>`), functions included. `unknown` would exclude exactly the values they exist to hold. |
| **Handwritten**: modules | `import` | `Module` is `StringMap<unknown>`, the exports of an evaluated module, functions among them. This workflow does not use it: the FJS loader replaces it. |
| **Deferred**: opaque host handles | `open`, `fstat`, `pread`, `close` | a `Handle` is `Nominal<..., unknown>`, minted by the runner and never inspected by the program. RTTI has no opaque-handle schema; the native runner would mint an index. Nothing in the CLI opens a file this way. |
| **Deferred**: async, servers, tests | `fetch`, `await`, `createServer`, `listen`, `readRequestBytes`, `forever`, `test` | asynchronous (the runtime decision is deferred), or carrying a callback (`createServer`'s listener, `test`'s body and context). RTTI already spells `never` as `or()`; `forever` is deferred for its async runtime, not its result schema. |

What follows for the tasks below:

- **Generated** means native declarations here. A runtime TypeScript printer
  sees `bigint`, not the nominal `Vec`; `Phantom` annotations affect static
  `Ts<>` inference but are erased at runtime. Keep the existing TypeScript
  API until an explicit nominal mapping preserves its signatures, as the
  [RTTI type-system plan](./rtti-type-system.md)'s nominal-types task requires.
- The first generated trait covers the compiler I/O operations and the separately
  selected console input `read` named above. Add schemas for the other
  data-shaped operations as consumers need them.
- The generation task must choose the Rust spelling of three shapes: the
  `Vec` nominal (RTTI checks `bigint`, while the native type must preserve
  bit-vector semantics), the `Result` union (already expressible with RTTI
  tuples and unions; a candidate is Rust `Result<T, E>` over a tagged-tuple
  error), and the `read` result `number | null` (already `or(number, null)`;
  `Option<u8>` also requires checking the byte range at the native boundary).
- The handwritten set is `sandbox`, `catch`, `all`, `memCreate`, `memRead` and
  `memWrite` for this workflow. The conformance tests must name each, since the
  generated trait checks none of them.

### Tasks

- [x] Audit the supported subset for RTTI representability ([Audit](#audit)):
      name the generated and handwritten operations, distinguish compiler I/O
      from the selected console input, and record what remains deferred.
- [x] Schemas for the named compiler I/O and console input operations
      ([`fjs/effects/schema`](../fjs/effects/schema/module.f.mjs)), with each
      hand-written declaration in `fjs/effects/node/types.ts` pinned to the
      type its schema derives ([`types.ts`](../fjs/effects/schema/types.ts)).
      The declarations stay handwritten; a future TypeScript printer must
      satisfy the nominal-mapping gate below before replacing them.
- [x] A Rust printer for these schemas
      ([`fjs/effects/schema/rust`](../fjs/effects/schema/rust/module.f.mjs))
      and the generated types and trait with one method per operation,
      committed as `nanvm-effects-node/src/gen.operations.rs` under
      `npm run gen`. The printer covers the vocabulary the operations use and
      refuses any other schema. `bigint` is `Vec<u8>`; the handwritten and
      unsupported operations are not in the trait.
- [ ] Add the handwritten native `sandbox` declaration and compose its dispatch
      with the generated subset, preserving the existing TypeScript signature.
- [ ] Before generating TypeScript declarations, define a nominal mapping
      that preserves `Vec` parameters and results, and check the emitted
      declarations against the existing API.
- [ ] Implement the operations exercised by the AOT-compiled CLI and
      parser-based proof fixtures in the runner crate
      (`nanvm-effects-node`, which exists with the generated trait and an
      `Unimplemented` runner), over `std`.
- [ ] Implement `sandbox` success, language-throw and duration behavior, with
      cross-host contract tests covering dispatch and callable values returned
      or thrown without losing their identity or requiring serialization.
- [ ] Cross-check applicable operations with the existing FJS virtual/mock
      interpreters; keep mutable host effects at the native boundary.
- [ ] Embed the runner in the native CLI without moving parser/compiler/loader
      logic into handwritten Rust.

### Related

- [FJS module loader](../fjs/compiler/todo/load-modules-without-import-effect.md).
- [FJS proof loading](../fjs/emergent_testing/todo/load-proofs-through-fjs.md).
- [console-program](../nanvm-lib/todo/console-program.md) — native packaging.
- [interpreter resource limits](../fjs/compiler/todo/bound-edag-interpreter-resources.md)
  and [worker isolation](../fjs/emergent_testing/todo/206-workers-as-a-sandbox.md).
