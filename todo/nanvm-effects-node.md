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
and generated FJS code. Define the shared operation vocabulary as RTTI and
derive its TypeScript types and Rust stub, with a handwritten implementation
of the generated trait. Commit generated output under `npm run gen`.

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

### Tasks

- [ ] Define the shared effect schema and generate the TS types and Rust stub
      for the supported subset, with unsupported operations accounted for.
- [ ] Add the runner crate and implement the operations exercised by the
      AOT-compiled CLI and parser-based proof fixtures.
- [ ] Implement `sandbox` success, language-throw and duration behavior, with
      cross-host contract tests.
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
