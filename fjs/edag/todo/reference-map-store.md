## Give the interpreters a store for reference maps

**Priority:** P4
**Status:** open — a problem statement; no design yet

### Problem

A [reference map](../../../spec/todo/reference-map.md) promises a call in
`O(log n)` steps. The interpreters answer the EDAG's `['refMap']` with the
runtime's map ([`../../js/ref_map`](../../js/ref_map/module.f.js)), which is
ordinary FunctionalScript: a list of pairs searched with `===`. Every answer
is right and a call takes `O(n)` steps.

A fast map needs a lookup table keyed on the identity of the interpreter's
values, and a table is not a value: every evaluated value is an EDAG
expression ([`../value/types.ts`](../value/types.ts), `_Subset`), which the
serializer, the function-text renderer and the memo interpreter's call all
rely on. The table would have to be kept beside the map, and an interpreter
has nowhere to keep it: each invocation starts with fresh state and answers a
value alone ([`../memo/module.f.mjs`](../memo/module.f.mjs), `invokeWith`), so
a table kept there is lost whenever a map is passed to a function or returned
from one.

### What a design has to settle

- A store that lasts across invocations, passed through every call of both
  interpreters, or another place for the tables.
- How a map's table is found again from the map's value, and rebuilt from its
  pairs where there is none.
- Whether a map written out after it was used is then written as the fold over
  the empty map that the proposal describes, where it is written today as the
  runtime's function with its pairs.

### Tasks

- [ ] Measure a program that needs it before designing: the interpreters run
  the compiler's own tools, and none of them uses a reference map yet.
- [ ] Propose the store and where it is threaded.
- [ ] Implement it, and prove the same answers as the runtime's map with the
  bound kept on older and newer maps alike.

### Related

- [Reference map](../../../spec/todo/reference-map.md) — the proposal.
- [`fjs/js/ref_map`](../../js/ref_map/module.f.js) — the map the interpreters
  use today.
