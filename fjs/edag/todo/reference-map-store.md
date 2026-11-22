## Give the interpreters a store for reference maps

**Priority:** P4
**Status:** open — a problem statement; no design yet

### Problem

A [reference map](../../../spec/built-ins/reference-map/README.md) promises a call in
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
value alone ([`../memo/module.f.js`](../memo/module.f.js), `invokeWith`), so
a table kept there is lost whenever a map is passed to a function or returned
from one.

### The index outside the value

One of three options, none chosen ([the options](./host-values.md#options)).
The map's value stays what it is, the runtime's function with its pairs, and
a host [reference map](../../types/ref_map/module.f.js) kept outside it
finds a key's pair quickly.

- The pairs have to be a linked list, as they are today. Kept as an array,
  each write copies it, and `n` writes take `O(n^2)` steps whatever the
  index does.
- A map is persistent, so an older map needs the index as it was: one index
  for each map, not one for all.

### What a design has to settle

- A store that lasts across invocations, passed through every call of both
  interpreters, or another place for the tables.
- How a map's table is found again from the map's value, and rebuilt from its
  pairs where there is none.
- Whether a map written out after it was used is then written as the fold over
  the empty map that the design record describes, where it is written today as the
  runtime's function with its pairs.

### Tasks

- [x] Measure a program that needs it before designing:
  [`fjs/types/map`](../../types/map/module.f.js) is built on the reference
  map, and the compiler's analysis on that map. The figures are in
  [host values](./host-values.md), which proposes a wider answer: with
  values the host's own, the map is the real one and there is no store.
- [ ] Propose the store and where it is threaded.
- [ ] Implement it, and prove the same answers as the runtime's map with the
  bound kept on older and newer maps alike.

### Related

- [Host values](./host-values.md) — the options side by side; values as the host's own make this store unnecessary.
- [A map as a value of its own](./reference-map-value.md) — the index kept inside the value.
- [Reference map](../../../spec/built-ins/reference-map/README.md) — the page, and its [design record](../../../spec/design/object-identity.md#reference-map).
- [`fjs/js/ref_map`](../../js/ref_map/module.f.js) — the map the interpreters
  use today.
