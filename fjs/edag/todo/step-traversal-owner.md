## Investigate common core chain-step traversal

**Priority:** P3
**Status:** open — optional core traversal research; FAST helpers implemented

### Current ownership

A chain step carries a property key or call-item list and, except for a terminal
step, a continuation. Folding its value operands or mapping them must preserve
metadata, spread tags, operand occurrence order and the terminal detached call.
Those structural operations are separate from deciding whether a region runs.

Common [`js/ast`](../../js/ast/module.f.mjs)'s `operatorOperands` and
`mapOperator` already own normalized FAST operand traversal. Their chain maps
and folds are iterative; the mapping callback's operand index distinguishes
repeated equal operands and includes only value operands, not static key
metadata. Common conversion and preparation use these helpers. The prepared
JavaScript and [Rust serializers](../../rust/serializer/README.md) spell their
own target continuation syntax with explicit work stacks.

The former `compiler/ast` fold, `compiler/edag.lowerStep` and direct
`serializer/function_text` item/step maps have been retired. The public
function-text module now delegates common conversion and prepared JavaScript
spelling. They are no longer consumers for a new graph traversal API to serve.

### Remaining optional core work

The linked `Exp` and analyzed `Node` representations still have helpers in
[`sharing`](../sharing/module.f.mjs) and
[`analysis`](../analysis/module.f.mjs), including operand folds and analysis
restoration. Their key metadata differs from normalized FAST: a graph key can
name a conversion node, while FAST records its conversion operand explicitly.
[`operations`](../operations/module.f.mjs) also processes item operands while
threading evaluation state and failures. That stateful operation is not a plain
structural map.

The source parser builds source continuation structure under its grammar and
optional-chain boundaries. Its `continuedSteps` and `stepClosed` walks are
source-stage concerns, distinct from raw graph restoration and target syntax.
A helper should cross those boundaries only if the actual consumers become
simpler; similar tuple shape alone is insufficient.

The original proposal put `stepOperands(key, args)`, `mapSteps(key, items)` and
`mapItems(f)` beside the EDAG schema. Reconsider that API against the remaining
core consumers before introducing it. The existing `StepOver<E, I>`,
`ItemsOver<E>` and `Over<T, E, I>` types describe graph shapes, but do not decide
whether source/FAST traversal should depend on the graph owner. No extra public
API or target placement rule is required by this note.

### Optional investigation

- [x] Supply common normalized FAST value mapping and operand traversal;
      migrate output conversion/preparation and retire old writer step maps.
- [ ] Compare `sharing`'s raw graph fold with analysis operand/restoration maps
      and operations' item handling. Identify a smaller shared helper only if
      it preserves each representation's metadata and reduces real duplication.
- [ ] If useful, implement it with the first consumers and direct proofs for
      keys, spreads, continuation order, repeated operands and terminal calls.
      Include depth evidence and retain each stage's scope/identity contract.
      Otherwise explain why the remaining walks are clearer separately and
      retire this note.

### Related

- [operand-classification-owner](./operand-classification-owner.md) — semantic
  region classification and reference-evaluator demand order.
- [identity-shared-walks](./identity-shared-walks.md) — optional identity-query
  consolidation, distinct from a structural step map.
- [deep-nesting-recursion](../../compiler/todo/deep-nesting-recursion.md) —
  historical depth cases and remaining input/admission limits; new FAST output
  work stacks do not make those independent boundaries stack-safe.
