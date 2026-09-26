## Make the memo executor's cache immutable

**Priority:** P3
**Status:** open

### Problem

`slot` in [`../module.f.mjs`](../module.f.mjs) captures `let filled` and
reassigns it when the returned closure is called. This host mutation is how
the current executor evaluates a shared node once per invocation. It is not
admitted FJS behavior, and the direct Rust backend's copied capture frames
cannot implement it merely by gaining parser coverage.

Compiling this executor unchanged would either require new mutable-capture
semantics or lose its memoization contract. The latter changes observable
identity: repeated references to one array constructor must return the same
array within an invocation. This is a semantic prerequisite for native
self-hosting, separate from ordinary compiler coverage and resource hardening.

This rewrite alone does not make the executor's dependency closure admitted
FJS. `invocation` and its analysis dependency also construct host `Map` values.
Their [container migration](../../../fsc/todo/load-modules-without-import-effect.md#native-prerequisites)
is a separate native prerequisite; immutable use of `Map` is not language
admission.

### Proposal

Replace the captured mutable cache with immutable evaluation state expressed
in FJS. Explicitly threading invocation state through evaluation is a candidate;
the state representation and any changes to evaluator plumbing remain to be
designed. Reuse the shared analysis and operation semantics, and preserve the
current observable behavior. This task does not approve mutable captures or
make the optional Rust EDAG executor a bootstrap dependency.

Sharing determines how many times a node is evaluated, not whether it is
demanded. A rewrite must not eagerly evaluate shared nodes to avoid carrying
state, and must not discard the cache and duplicate constructors. Each function
invocation owns its cache; captured values keep their existing identities.

### Tasks

- [ ] Design and implement immutable invocation/cache state without captured
      binding mutation, keeping evaluation lazy and reusing analyzed indices.
- [ ] Preserve the existing `shared`, `merged`, `lazy`, `body` and `throw` proofs
      in [`../proof.f.mjs`](../proof.f.mjs). Cover a shared constructor reached
      through multiple taken branches, a throwing node behind untaken branches,
      fresh body values across calls and retained captured-frame identity.
- [ ] Once the required syntax and dependency closure compile, run the same
      cases through direct Rust AOT and compare with the JavaScript-hosted
      executor. Do not mark native readiness on syntax acceptance alone.

### Related

- [interpret-edag](../../../fsc/todo/interpret-edag.md) — owns public validation
  and interpreter integration; the host baseline already exists.
- [FJS module loading](../../../fsc/todo/load-modules-without-import-effect.md) —
  its native path depends on this rewrite; Node loading can proceed separately.
- [callable-function-objects](../../../../nanvm-lib/todo/callable-function-objects.md)
  — the direct AOT captured-frame contract.
