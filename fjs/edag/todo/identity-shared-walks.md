## Investigate shared identity traversal

**Priority:** P4
**Status:** open — optional core traversal research; output placement migrated

### Current ownership

[`analysis`](../analysis/module.f.mjs) builds a table that merges structurally
equal identity-free nodes within each scope; `identityAnalysis` retains source
node identity. The latter uses [`sharing`](../sharing/module.f.mjs)'s
`sharedNodesOf` for repeated source-object counts. Distinct equal allocations
remain distinct, while two edges to the same allocation retain sharing.

**Common output placement is implemented.** Every output path consumes
[`to_fast`](../to_fast/README.md) and common
[preparation](../../js/ast/prepare/README.md). The conversion selects required
bindings, lazy owners and execution regions; preparation chooses memo storage,
loop slots and transfers. JavaScript and Rust serializers receive prepared
instructions. The former direct writers' binding walks, including Rust's
independent extra-operation bindings, have been retired. Their old emitted
bytes are not a second policy to preserve.

The [prepared Rust serializer](../../rust/serializer/README.md) owns lexical
names, declarations and runtime mapping. Its binding identities and externally
supplied names come from common conversion. It does not infer graph sharing or
choose another scope for a value. An optimized backend consuming EDAG directly
would be separate future work.

This leaves optional core traversal research, not unfinished output migration.
A shared walker is useful only if it simplifies the remaining queries without
obscuring their different boundaries.

### Remaining query contracts

`sharing.operandsOf` walks linked `Exp` objects and follows only function
captures. `analysis.operandsOf` walks analyzed `Node` operands and includes
captures followed by the body. A one-invocation query must stop at nested
function bodies; whole-program capability queries may include them.

The [EDAG-to-Rust adapter](../rust/module.f.mjs) still makes raw graph queries
for capability/import metadata and supplied invocation environments. It does
not make binding-placement decisions. `compiler/rust` delegates common graph
conversion and prepared emission through that adapter.

Common `to_fast` makes its own region-local queries over the analyzed table:

- A binding stops descent because its established value is already available.
- Repeated operand occurrences count as repeated edges; a shared subtree's
  children are not multiplied by every path to that subtree.
- Lazy ownership compares the current region with its child regions and eager
  reachability, preserving shared allocation identity on successful paths.
- Captures remain in the constructing invocation; function bodies own their
  invocation-local values. Explicit anchors retain required work.

A single global set of shared objects cannot replace those queries. A merged
analysis table also answers a different question from source-identity counts:
distinct structural-twin parents can both reach one constructor, which must
remain shared. Canonical binding-read and capture normalization have their own
[documented graph domain](../to_fast/README.md); traversal cleanup must not
silently change it or attach a normalized graph to its former hash.

`nanvm/rust`'s `reaches` has another purpose: it selects a corpus group's named
values from `data.shared`. Such a value needs its supplied binding even when
reached once. It is not an ordinary repeated-edge count, and its names enter
common conversion as explicit external bindings.

Reference-evaluator demand order and permitted output failure reordering are
separate contracts, as described in
[operand classification](./operand-classification-owner.md#reference-demand-order-and-output-failure-reordering).
Traversal consolidation must preserve successful lazy paths and identity; it
need not enforce the same first failing operation in generated output.

### Optional investigation

- [x] Move source/Rust binding placement and lazy-region decisions to shared
      FAST conversion and preparation; retire the direct writer policies.
- [ ] Determine whether a shared walk simplifies raw identity queries in
      `analysis`, the Rust adapter's capability queries, or the corpus's
      supplied-binding reach checks. Keep repeated edges, dependency order,
      scope boundaries and caller-supplied bindings explicit.
- [ ] If it simplifies the code, prove those query contracts against existing
      sharing, structural-twin, capture and lazy-region cases. A traversal-only
      cleanup should keep canonical graph identity and generated output
      unchanged. Run affected checks. Otherwise record why the separate
      representations need separate walks and retire this note.

### Related

- [`sharing`](../sharing/module.f.mjs) — linked-object identity queries.
- [analysis](./analysis.md) — merged and identity-table contracts.
- [`to_fast`](../to_fast/README.md) — common output placement and normalization.
- [`edag/rust` proofs](../rust/proof.f.mjs) — raw graph adapter regression cases.
- [prepared Rust serializer](../../rust/serializer/README.md) — completed target
  declaration ownership, separate from optional graph traversal consolidation.
