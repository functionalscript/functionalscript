## Make the memo executor's cache immutable

**Priority:** P3
**Status:** open — immutable invocation state implemented; native parity remains

### Problem

The previous `slot` in [`../module.f.mjs`](../module.f.mjs) captured `let filled`
and reassigned it when the returned closure was called. The EDAG-value
migration replaces it with immutable cache state threaded through demanded
operands. Shared nodes retain their values within an invocation; calls start
fresh caches and retain evaluated captures.

Compiling that baseline unchanged would either have required new mutable-capture
semantics or lost its memoization contract. The latter changes observable
identity: repeated references to one array constructor must return the same
array within an invocation. This is a semantic prerequisite for native
self-hosting, separate from ordinary compiler coverage and resource hardening.

This rewrite alone does not make the executor's dependency closure admitted
FJS. Its analysis dependency still constructs host `Map` values.
Their [container migration](../../../compiler/todo/load-modules-without-import-effect.md#native-prerequisites)
is a separate native prerequisite; immutable use of `Map` is not language
admission.

### Proposal

The cache is an immutable association list from analyzed node indices to
`EdagValue`s. Evaluation threads it alongside language results; only demanded
shared nodes acquire entries. The native step below must prove this behavior
after the interpreter's dependency closure compiles. This task does not approve
mutable captures or make the optional Rust EDAG executor a bootstrap dependency.

Sharing determines how many times a node is evaluated, not whether it is
demanded. A rewrite must not eagerly evaluate shared nodes to avoid carrying
state, and must not discard the cache and duplicate constructors. Each function
invocation owns its cache; captured values keep their existing identities.

### Tasks

- [x] Design and implement immutable invocation/cache state without captured
      binding mutation, keeping evaluation lazy and reusing analyzed indices.
- [x] Preserve the existing `shared`, `merged`, `lazy`, `body` and `throw` proofs
      in [`../proof.f.mjs`](../proof.f.mjs). Cover a shared constructor reached
      through multiple taken branches, a throwing node behind untaken branches,
      fresh body values across calls and retained captured-frame identity.
- [ ] Once the required syntax and dependency closure compile, run the same
      cases through direct Rust AOT and compare with the JavaScript-hosted
      executor. Do not mark native readiness on syntax acceptance alone.

### Related

- [interpret-edag](../../../compiler/todo/interpret-edag.md) — owns public validation
  and interpreter integration.
- [FJS module loading](../../../compiler/todo/load-modules-without-import-effect.md) —
  its native path depends on parity and compiler coverage; Node loading can proceed separately.
- [callable-function-objects](../../../../nanvm-lib/todo/callable-function-objects.md)
  — the direct AOT captured-frame contract.
