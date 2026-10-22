## Reconcile core operand classification

**Priority:** P3
**Status:** open — optional core traversal research; output ownership migrated

### Current ownership

Common [`to_fast`](../to_fast/README.md) now chooses graph bindings, eager and
lazy regions, and shared-value ownership for source JavaScript, runtime values,
function text and Rust. Common [preparation](../../js/ast/prepare/README.md)
chooses physical memo storage and loop state. Target serializers consume
prepared instructions and make no independent graph placement decision.

The former classifiers in `compiler/ast`, the direct FunctionalScript writer,
and the direct Rust writer have been retired. Their disagreement is no longer
a reason to export a second placement API. Remaining core representations still
have different uses:

- [`analysis`](../analysis/module.f.mjs) supplies operands of analyzed `Node`s.
- [`sharing`](../sharing/module.f.mjs) queries linked `Exp` objects by identity.
- [`operations`](../operations/module.f.mjs) implements reference evaluation and
  its operational operand-demand order.
- [`to_fast`](../to_fast/module.f.mjs) classifies operands for common placement,
  stopping at established bindings and respecting successful lazy paths.
- [`js/ast`](../../js/ast/module.f.mjs) maps normalized value operands and chain
  metadata without choosing evaluation regions.

Whether a smaller shared core helper would simplify these consumers remains
worth investigating. The shared output migration is complete independently of
that optional consolidation.

### Reference demand order and output failure reordering

The reference evaluator reads a plain method's property before demanding its
`|()` arguments. Its `property` helper uses the existing failure channel: a
failed read demands no arguments, while a successful read demands them before
checking whether the result is callable. Operational demand-trace proofs may
pin that interpreter behavior.

That order does not require an output serializer to preserve the first failing
operation. Under [failure is one outcome](../../../spec/principles/README.md#failure-is-one-outcome),
throw payloads, first failure, evaluation counts and work before failure are
not language observations. For example:

```js
const x = ['[]', [['throw', 'argument']]]
const argument = ['[]', [x, x]]
const root = ['.', null, 'f', ['|()', [argument]]]
```

The reference evaluator fails at the null receiver; output that establishes the
argument first can fail there instead. Both executions fail. The former version
of this note called that difference a serializer semantic defect; that claim
was incorrect. It requires no source-order barrier or writer-specific lazy
region.

Successful paths remain binding. A skipped optional-chain argument that would
fail must stay skipped. A demanded shared constructor must retain its identity,
and successful receiver-sensitive method calls must retain their receiver.
A placement that introduces a failure on a formerly successful path, or deletes
a required failure to invent success, is a defect. Those are the contracts for
shared conversion and preparation to prove.

The former direct Rust printer also refused some values shared only between
method arguments because its private placement had no suitable region. That
writer and refusal path have been retired. Common FAST now supplies the region
and memo decision to the [prepared Rust serializer](../../rust/serializer/README.md).
No target-specific classifier should be restored to reproduce the old refusal.

### Optional investigation

- [x] Retire independent source/Rust writer placement and use common FAST.
- [ ] Compare the remaining raw `Exp`, analyzed `Node` and normalized FAST
      operand helpers. Share a traversal only if it reduces their code and
      keeps representation metadata, scope boundaries and binding stops clear.
- [ ] If a shared helper is useful, record the reference evaluator's demand
      order separately from the output placement freedom above. Preserve
      optional-chain success, demanded allocation identity and required work;
      do not add first-failure barriers.
- [ ] Prove unchanged successful behavior, reference-demand traces where they
      are the subject of the helper, and the existing indistinguishable-failure
      contract. Run the affected checks and regenerate only affected outputs.
      Otherwise record why separate helpers are simpler and retire this note.

### Related

- [identity-shared-walks](./identity-shared-walks.md) — optional raw graph walk
  consolidation, distinct from common output placement.
- [step-traversal-owner](./step-traversal-owner.md) — chain metadata folds/maps.
- [analysis](./analysis.md) — graph sharing and identity contracts.
