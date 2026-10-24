# Analysis

One pass over an EDAG that answers what both a writer and a VM need to know
without running it: which nodes are shared. Sharing is node identity, and a
walk sees identity only by keeping a map of nodes it has met, so `analysis`
walks once and returns a table that needs no such map downstream.
[`module.f.mjs`](./module.f.mjs) holds it, and the `Analysis` table is
described in [`types.ts`](./types.ts).

The table lists every operation node once, in walk order, naming its operands
by index; the scope each node belongs to; and the indices reached by more than
one edge. A writer hoists those into a `const`; an interpreter caches them.

|Export                |Answers                                                                        |
|----------------------|-------------------------------------------------------------------------------|
|`analysis(graph)`     |the table, with nodes merged where their identity is decided by their inputs   |
|`identityAnalysis(graph)`|the table with nothing merged: every node its own entry                     |
|`operandsOf`, `ownOperandsOf`, `stepOperands`, `itemOperand`|an entry's operands                |
|`scopeHolds`, `checked`, `mergeable`|the helpers the writers and VMs ask of the table                  |

**Merged before counted.** In `analysis`, a node whose result is decided by
its inputs (a property read, an operator, the comma) is one entry with every
other node in its scope spelled the same over the same inputs, so
`[cfg.a, cfg.a]` reads `cfg.a` once. A constructor (`[]`, `{}`, `=>`) and a
call make a fresh value each time, so they are never merged: two `[]` are two
arrays.

**By identity alone.** `identityAnalysis` merges nothing, so the table keeps
exactly the sharing the graph has and adds none. The FunctionalScript writer
uses it, and so does [`memo`](../memo/README.md), so that a function value
holds its body as the graph has it.

[`../execution-models.md`](../execution-models.md) §2.2 describes how the
writers and interpreters use the table, and [`sharing`](../sharing/module.f.mjs)
is the identity walk underneath it.
