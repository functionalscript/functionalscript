# Identity-aware `parse`

**Priority:** P3
**Status:** open

## Problem

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

`edag/module.f.mjs` doesn't call `parse` today — it only validates (`validate`) values
already in the JS thunk-graph representation, where sharing is whatever the caller's own
references already are. This TODO is about the day something needs to *read* an EDAG
back from a form that doesn't have JS references at all (serialized bytes, JSON, a
parsed wire message) and reconstruct the sharing faithfully.

## Possible direction (not decided)

An identity-aware `parse` would need to key its memoization off the **input**
reference, not the schema position: a `WeakMap<input, output>` populated as `parse`
walks a container, checked before allocating a fresh one for that input again. This
only helps when the sharing already exists as a JS reference before `parse` runs (e.g.
reading `Data`'s `$ref`-style back-references, or a JS value someone else already
deduplicated) — a purely textual/byte serialization needs its own explicit sharing
encoding (back-references by index, similar to `$defs`/`$ref` in
`../../../media/json/schema/module.f.mjs`) before there is anything to key a `WeakMap`
on. Which of these `edag` will actually need depends on what format it ends up reading
EDAGs from, which isn't decided yet.

## Related

- [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) — the schema this matters
  for; references this TODO.
- [`../../../../todo/edag-stage1-discussion.md`](../../../../todo/edag-stage1-discussion.md)
  — "The core invariant" and subject 1 (sharing is semantic), subject 4 (the contrasting
  case where identity is *not* observable).
- [`../parse/module.f.mjs`](../parse/module.f.mjs) — today's identity-oblivious reader.
- [`../README.md`](../README.md) — "The two schema-form readers."
