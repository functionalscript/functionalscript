## stack-safe-rewrite. The rewrite recurses per node, so nesting overflows it

**Priority:** P3 — a prerequisite of any reader that maps a nested grammar:
the value route stage 3b of
[parser-serializer-restructure](../../../../todo/parser-serializer-restructure.md)
declined, and stage 4's grammar route. Not of stage 3b's token-stream
grammar, whose tree is flat.
**Status:** open

### Problem

`rewriteRule` in [`../module.f.mjs`](../module.f.mjs) rewrites a node by
calling itself on each child — a tuple's elements, a variant's branch, a
`const` thunk's payload, a repetition's rounds — before applying the node's
own function. The JS call stack therefore grows with the **nesting depth of
the input**, not with the grammar, which is exactly the shape
[`../../ll1/module.f.mjs`](../../ll1/module.f.mjs) refuses for its matcher:
that one loops over frames it keeps on the heap, "so a recursive matcher
would overflow the JS stack on a few thousand nested brackets, where this
one's stack grows on the heap."

Measured over `[json, eof]`, with `json` from
[`../../lib/json`](../../lib/json/module.f.mjs):

| input | `fjs/ebnf/ll1` | `rewrite([])` on its tree | today's `fjs/media/json` |
|---|---|---|---|
| 1,000 nested arrays | ok | `RangeError: Maximum call stack size exceeded` | ok |
| 5,000 nested arrays | ok | `RangeError` | ok — a proof requires it |
| 6,000 nested arrays | ok | `RangeError` | ok |
| 6,000 sibling `[]` | ok | ok | ok — a proof requires it |

The empty map is the identity, so this is the walk itself, not any mapping.
Siblings are fine because a repetition's rounds are mapped in a loop; only
nesting recurses.

The consequence is a contract break.
[`../../../media/json/parser`](../../../media/json/parser/module.f.mjs)
walks containers on its own heap stack and its proof
([`proof.f.mjs`](../../../media/json/parser/proof.f.mjs), `siblingContainers`)
pins 5,000 nested and 6,000 sibling containers as `ok`, after a regression that
overflowed at that depth was fixed. A reader that maps a nested grammar — the
value route stage 3b declined, or a DataJS reader that maps its grammar to
values — throws on input the public `parse` accepts under a `Result` contract.
A token-stream grammar's tree is flat and is not reached: 20,000 nested
brackets lex to 40,000 tokens and rewrite without incident, which is how stage
3b sidesteps this rather than depending on it.

### Proposal

Walk the tree as `ll1` walks the input: one loop over an explicit stack of
frames, each holding the rule, the node, and the children rewritten so far,
applying the rule's function when its last child is done. Every assertion the
recursive walk makes — arity, branch, symbol, bounds, a rule spelled twice —
is made at the same point of the loop, so the refusals do not move. The
signature and the types in [`../types.ts`](../types.ts) do not change; this is
the walk only.

### Tasks

- [ ] The loop, replacing the mutual recursion of `rewriteRule`,
      `dataChildren` and `thunkChildren`.
- [ ] Proofs mirroring the parser's: 5,000 nested arrays and 6,000 sibling
      containers rewritten by the empty map and by a value-building map, in
      [`../proof.f.mjs`](../proof.f.mjs); the existing refusal proofs
      unchanged.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../ll1/module.f.mjs`](../../ll1/module.f.mjs) — the heap-stack loop
  this walk should mirror.
- [`../../../media/json/parser/proof.f.mjs`](../../../media/json/parser/proof.f.mjs)
  — the depth contract, and the regression note that explains it.
- [self-contained-tokenizer](../../../media/json/todo/self-contained-tokenizer.md)
  — stage 3b, which declined the value route partly for this; its token-stream
  tree is flat, so this is related there, not a prerequisite.
- [parser-serializer](../../../media/datajs/todo/parser-serializer.md) — stage
  4's grammar route has the same dependency.
