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
the existing RTTI vocabulary, define their data schemas and derive the
TypeScript declarations and Rust stub, with a handwritten implementation of
the generated trait. Commit generated output under `npm run gen`.

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

### Tasks

- [ ] Audit the supported subset for RTTI representability, then generate TS
      declarations and the Rust stub for the representable operations. Account
      explicitly for handwritten and unsupported operations.
- [ ] Add the handwritten native `sandbox` declaration and compose its dispatch
      with the generated subset, preserving the existing TypeScript signature.
- [ ] Add the runner crate and implement the operations exercised by the
      AOT-compiled CLI and parser-based proof fixtures.
- [ ] Implement `sandbox` success, language-throw and duration behavior, with
      cross-host contract tests covering dispatch and callable values returned
      or thrown without losing their identity or requiring serialization.
- [ ] Cross-check applicable operations with the existing FJS virtual/mock
      interpreters; keep mutable host effects at the native boundary.
- [ ] Embed the runner in the native CLI without moving parser/compiler/loader
      logic into handwritten Rust.

### Related

- [FJS module loader](../fjs/fsc/todo/load-modules-without-import-effect.md).
- [FJS proof loading](../fjs/emergent_testing/todo/load-proofs-through-fjs.md).
- [console-program](../nanvm-lib/todo/console-program.md) — native packaging.
- [interpreter resource limits](../fjs/fsc/todo/bound-edag-interpreter-resources.md)
  and [worker isolation](../fjs/emergent_testing/todo/206-workers-as-a-sandbox.md).
