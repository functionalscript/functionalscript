# Identity-aware `parse` and `validate`

**Priority:** P3 (correctness for `parse`) / P2 (`validate`'s CPU blowup is a DoS vector
on a public input boundary, not just a fidelity gap)
**Status:** open

## Problem

Neither `parse` nor `validate` track input identity — no notion of "I already
handled this exact reference elsewhere." For `parse`, that loses information silently
(see below). For `validate`, it's worse: it re-walks a shared subgraph once per
incoming edge, so validating a small, legitimately shaped (acyclic!) shared graph costs
time exponential in its depth.

Verified against `58a0c7ed`:

```js
let x = ['args']
for (let i = 0; i < 18; i++) { x = ['[]', [x, x]] }
validate(exp)(x)   // 509ms locally, for a value built from 19 distinct arrays
```

Each iteration only *doubles the sharing*, not the graph's size — `x` is still built
from 19 distinct array objects at depth 18. But `validate` doesn't know that two
branches are the same reference, so it walks the shared subtree through both edges,
and the cost compounds every level: ~14s by depth 22 (reported independently against a
later commit). This is exactly the kind of small, cheap-to-construct-but-expensive-to-check
input the "public `Function` constructor input" threat model
(`todo/edag-stage1-discussion.md`, "Validation") exists to guard against — a caller
does not need a *large* value to burn CPU, just a deeply *shared* one.

### `parse`'s identity loss

`parse` always constructs a fresh container per schema position it visits — it has no
notion of "I already built this for the same input reference elsewhere, reuse that."
So when the same input value is reachable from two different positions, the two
resulting outputs are never `===`, even though the input was.

Verified against `58a0c7ed`:

```js
const shared = [0, 0]
const input = [shared, shared]
const [, out] = parse(array(array(0)))(input)

shared === shared     // true — one input reference, used twice
out[0] === out[1]     // false — parse rebuilt two separate arrays
out[0] === shared     // false — neither output equals the original either
```

`parse` isn't wrong to do this for its usual job: reading a JSON-like document, a
config file, a protocol frame. Nothing in that domain treats `a === a` as part of the
data's meaning — two structurally equal values are just two equal values, and rebuilding
fresh containers is what makes `parse` a safe reader of untrusted, possibly-aliased
input in the first place (see `../README.md`, "The two schema-form readers").

## Why it matters for `../../../edag`

The EDAG is the one schema in this codebase where reference identity between operand
positions *is* part of the value's meaning — see
[`edag-stage1-discussion.md`, "The core invariant"](../../../../todo/edag-stage1-discussion.md#the-core-invariant):
`["[]", x, x]` and `["[]", ["{}"], ["{}"]]` are different functions specifically because
sharing is observable, and hashing is defined as "structural identity of the graph as
written." A reader that needs to reconstruct an EDAG from a serialized or otherwise
untrusted form (bytes, JSON, a wire frame) has to preserve that: two operand positions
that were the same node before serialization must come back as the same node, not two
equal-but-distinct copies.

The generic `parse` cannot do this today. Used naively on such input, it would silently
flatten every DAG into a tree — every function would round-trip into a *different*,
unshared function, changing its hash even though nothing about the program's meaning
changed. (This is the flip side of the entry-descriptor discussion in
`edag-stage1-discussion.md` subject 4: there, identity was never observable, so nothing
needed preserving; here, identity **is** observable, so losing it silently is a real
correctness gap, not a hygiene nicety.)

`edag/module.f.mjs` calls neither today — its own `Assert<Check<...>>` typedefs exercise
`Ts<>` (a type-level, not runtime, walk), and `proof.f.mjs` calls `validate` against
values already in the JS thunk-graph representation, where sharing is whatever the
caller's own references already are and re-walking a small test fixture a few extra
times is unobservable. Both gaps become live the moment something either reads an EDAG
back from a form without JS references at all (serialized bytes, JSON, a parsed wire
message — the `parse` gap) or runs `validate` against a graph shaped by an untrusted,
possibly adversarial caller instead of a proof's small fixtures (the `validate` gap,
already live today, cost-wise, for *any* caller of `validate(exp)` on a real graph).

## Possible direction (not decided)

Both need memoization keyed off the **input** reference, not the schema position — a
`WeakMap`/`WeakSet` populated as the reader walks a container, checked before doing the
work for that input again:

- For `parse`, the memo would hold the **output** built so far for a given input
  reference, so a second visit reuses it instead of rebuilding. This only helps when the
  sharing already exists as a JS reference before `parse` runs (e.g. reading `Data`'s
  `$ref`-style back-references, or a JS value someone else already deduplicated) — a
  purely textual/byte serialization needs its own explicit sharing encoding
  (back-references by index, similar to `$defs`/`$ref` in
  `../../../media/json/schema/module.f.mjs`) before there is anything to key a
  `WeakMap` on.
- For `validate`, the memo only needs to record "already validated this reference, and
  it passed" — no output to reuse, since `validate` returns the input as-is. This is a
  change to `validate`'s generic engine (or an edag-specific wrapper that walks ahead of
  it), not just to `edag`'s schema, and it composes with cycle-safety: the same
  `WeakSet` walk that detects "currently being validated, and reached again" (a cycle)
  is the one that would detect "already validated, skip" (the memoization).

Which of these `edag` will actually need — and whether `validate`'s fix lives in the
generic engine or as an edag-specific layer on top — isn't decided yet.

## Related

- [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) — the schema this matters
  for; references this TODO.
- [`../../../../todo/edag-stage1-discussion.md`](../../../../todo/edag-stage1-discussion.md)
  — "The core invariant" and subject 1 (sharing is semantic), subject 4 (the contrasting
  case where identity is *not* observable), and "Validation" (the public-input threat
  model this DoS angle falls under).
- [`../parse/module.f.mjs`](../parse/module.f.mjs) — today's identity-oblivious reader.
- [`../validate/module.f.mjs`](../validate/module.f.mjs) — today's non-memoizing,
  cycle-unsafe reader.
- [`../README.md`](../README.md) — "The two schema-form readers."
