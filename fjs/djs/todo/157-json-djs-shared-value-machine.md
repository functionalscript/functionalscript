## 157. JSON/DJS: extract the shared value-machine core

**Priority:** P3
**Status:** open

DJS is a superset of JSON: every JSON value is a DJS value, plus DJS adds
`bigint`, `undefined`, identifier keys, const references, and module
(`import`/`const`/`export default`) framing. Because of that relationship the
two stacks should share their value-level machinery. Today they don't — three
separate pairs of modules each fork the same JSON value algorithm and then add
the small DJS delta on top.

The lexical layer is *partly* shared, and less than this issue once claimed.
The grammar-based DJS tokenizer takes `isKeywordToken` and `mergeTrivia` from
`fjs/js/tokenizer` and the simple-escape table from `fjs/js/string_escape`, but
classifies characters and decodes numbers itself — whether that remainder is
worth sharing is a lexer question, not this one. The duplication tracked here is
one level up, in the **value** layer: parser, serializer, and the tokenizer's
minus-rewriter.

This issue tracks all three because they share one root cause; each part can be
landed independently.

### 1. Parser value-state machine — superseded

**This sub-task is done with, and must not be implemented.** It proposed sharing
one container-building state machine between JSON and DJS because the two were
line-for-line the same. The DJS half no longer exists: `fjs/djs/parser` is a BNF
grammar over token symbols, and the value-state alphabet, the `pushValue` /
`startArray` / `endObject` helpers, and the `parseValueOp`…`parseObjectCommaOp`
family this issue tabulated were deleted with it.

What remains on the JSON side is one implementation, not two, so there is nothing
left to share. Extracting a "shared" machine now would mean **recreating the
deleted DJS one** to have a second consumer — the outcome the parser work
explicitly ruled out.

The requirement this sub-task carried that is still live is a JSON-only one, and
it is stated in the task list below: a structural parse must keep `NumberToken`
numeric leaves rather than collapsing them to JavaScript `number` eagerly, so
extended, standard-compatibility, and RTTI policies can read the same token tree.
That belongs to whichever JSON work needs it, not to a JSON/DJS extraction.

### 2. Recursive serializer walker (two copies, down from three)

The same recursive `typeof`-dispatch walker was written three times. Two of the
three have since been folded, from opposite ends, so the count below is what is
left rather than what this section was filed against:

- `fjs/media/json/serializer/module.f.mjs` — `treeSerialize(leafSerialize)(sort)`,
  now a factory. `fjs/media/json`'s `serialize` and the extended codec are two
  applications of it, not two copies.
- `fjs/djs/serializer/module.f.mjs` — `buildSerialize`, which absorbed both DJS
  walkers (sub-task 2b below).

So the remaining duplication is one walker per family, and the extraction point
already exists and is exported: `treeSerialize`. The question is no longer "where
should a shared walker live" but "is one walker with the seams DJS needs better
than two" — which **the delta is three seams** below sets out, and does not
presume.

Both still define the same closure cluster — `propertySerialize`,
`mapPropertySerialize`, `objectSerialize`, the recursive `f`, and
`arraySerialize = compose(map(f))(arrayWrap)` — and both already import their
*leaves* (`objectWrap`, `arrayWrap`, `colon`, `stringSerialize`, …) from
`fjs/media/json/serializer/module.f.mjs`. Only the walker was copied.

**Sub-task 2b (done):** the two DJS functions collapsed into one
`buildSerialize(keySerialize)(refLookup)(sort)` factory in
`fjs/djs/serializer/module.f.mjs` — `serializeWithoutConst` supplies
`jsonKeySerialize` and no ref lookup, `serializeWithConst` supplies
`jsKeySerialize` and a closure substituting `c<N>` references. What remains of
this section is sharing one walker between that factory and JSON's
`treeSerialize`.

What that costs is set out under **the delta is three seams** below. Note the
shape of `buildSerialize` above: it already takes the key seam and the
pre-recursion seam as parameters, which is the same shape a shared walker would
need — this section is about whether the two can be one function, not about
discovering what varies.

This serializer sub-task is independent of the exact-number parser dependency
above and may land separately.

**Not blocked on [663](./663-json-djs-tree-type.md).** `fjs/djs/types.ts` already
carries `Assert<Equal<Unknown, Tree<Primitive>>>`, so DJS's value type *is* the
shape `treeSerialize` is typed over — 663 changes how that shape is spelled and
where it lives, not whether the two agree. The walker can be shared before 663
lands.

**The delta is three seams, not one.** `leafSerialize` cannot absorb the other
two, and the dispatch order is why:

```js
// json/serializer — the leaf seam runs last, and only for non-containers
const f = value => {
    if (value instanceof Array) { return arraySerialize(value) }
    if (isObject(value)) { return objectSerialize(value) }
    return leafSerialize(value)
}

// djs/serializer — the ref lookup runs first, before any dispatch
const f = value => {
    const ref = refLookup(value)
    if (ref !== null) { return ref }
    switch (typeof value) { /* ... */ }
}
```

A shared *array or object* carrying a `cref` would be dispatched as a container
before a leaf seam ever saw it, and the reference would be lost. So the sharing
needs:

1. **a leaf seam** — DJS adds `bigint` and `undefined`;
2. **a pre-recursion seam** — `refLookup`, running before container dispatch, so
   a shared container can short-circuit to `c<N>`;
3. **a key seam** — `keySerialize`. JSON emits every key as a string; DJS emits
   `__proto__` in computed form, because `{"__proto__": v}` is a prototype
   assignment in JavaScript and would not read back the value it was given.
   Round-tripping depends on it, so it is not a style difference the shared
   walker can hardcode away.

Whether one walker with three seams is better than two walkers is the question
this sub-task actually has to answer.

### 3. Tokenizer minus-rewriter

> Stale: the old state-machine `fjs/djs/tokenizer` this item describes was
> deleted and replaced by a grammar-based tokenizer. Re-verify current duplication
> before acting on this section.

`fjs/media/json/tokenizer/module.f.mjs` and the old DJS tokenizer both wrapped the
shared JS tokenizer and folded a leading `-` into the following numeric token.
The current DJS tokenizer retains similar mapping/state logic, but the names and
line numbers changed. Any extraction here must first re-measure the current code.

### Tasks

- [x] **Parser sub-task: superseded**, not done — see §1. DJS no longer has a
      value-state machine to share, so there is no extraction left to make.
- [ ] JSON only: keep `NumberToken` numeric leaves through a structural parse
      rather than collapsing them to JavaScript `number` eagerly, so extended,
      standard-compatibility, and RTTI policies read one token tree. This is what
      survives of the parser sub-task, and it is not a DJS concern.
- [x] Collapse the two DJS serializer variants through an optional ref hook —
      landed as `buildSerialize` in `fjs/djs/serializer/module.f.mjs`.
- [ ] Extract the serializer walker independently, shared between JSON's
      `serialize` and DJS's `buildSerialize`, where useful.
- [ ] Re-measure the current tokenizer minus-folding duplication before extracting
      it; do not implement the stale line-number design blindly.
- [ ] Preserve current behavior/proof coverage for both JSON and DJS.
- [ ] `npx tsc`, `fjs t`.

### Notes

- Only extract once both consumers exist — they do here (JSON and DJS are both
  shipping). This satisfies the second-real-consumer rule.
- Watch the existing DJS serializer's mutable `Refs` behavior; if touched, prefer
  threading an immutable accumulator rather than spreading mutation into the
  shared abstraction.
- The exact-number dependency is settled: `fjs/media/json/parser` keeps the
  lexeme available to each policy, so the parser extraction can be rebased on it
  and the serializer cleanup remains independent.

### Related

- [`fjs/media/json/README.md`](../../media/json/README.md) — the shared structural
  parse to rebase the parser sub-task on, and why its numeric seam is a policy
  rather than a materialized token tree.
- [JSON numeric edge cases](../../media/json/todo/number-edge-cases.md) — decides
  materialization for exponent overflow, oversized bare integers, and standard
  compatibility.
- `i003` (retired; shipped as this module) — the original DJS design: parse a
  module into a flat list of constants addressed by index. It landed verbatim —
  [`ast/types.ts`](../ast/types.ts) carries the shape and
  [`fjs/djs/README.md`](../README.md) records why the list is flat, with the
  design's own `['cref', n]` / `['aref', n]` / `['array', …]` spellings visible
  in [`parser/proof.f.mjs`](../parser/proof.f.mjs).
- `i77` (retired) — identifier property names, the DJS object-key delta. It was
  `Support for property accessor`, and its whole body was a pointer to the spec
  section plus a sketch of the operators (`instant_property`, `at`,
  `own_property`) each accessor form lowers to. The issue is gone; the section
  it pointed at survives as
  [`spec/todo/2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md).
