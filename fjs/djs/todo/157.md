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

### 2. Recursive serializer walker (three copies)

The same recursive `typeof`-dispatch walker is written three times:

- `fjs/media/json/module.f.mjs:49` (`serialize`)
- `fjs/djs/serializer/module.f.mjs:79` (`serializeWithoutConst`)
- `fjs/djs/serializer/module.f.mjs:117` (`serializeWithConst`)

Each defines the identical closure cluster: `propertySerialize`
(`flat([stringSerialize(k), colon, f(v)])`), `mapPropertySerialize`,
`objectSerialize = fn(entries).map(sort).map(mapPropertySerialize).map(objectWrap).result`,
the recursive `f` switching on `typeof`, and
`arraySerialize = compose(map(f))(arrayWrap)`. The serializer already imports
its primitives (`stringSerialize`, `objectWrap`, `arrayWrap`, …) from
`fjs/media/json/serializer/module.f.mjs`, so the leaves are shared; only the walker was
copied.

The deltas:

- JSON's `f` handles `boolean | number | string | null | Array | Object`;
  DJS adds `bigint` and `undefined`.
- `serializeWithConst` is `serializeWithoutConst` plus a ref-counter
  short-circuit prepended to `f`.

**Sub-task 2b (clearest, smallest, done):** the two DJS functions now collapse
into one `buildSerialize(refLookup)(sort)` factory in
`fjs/djs/serializer/module.f.mjs` taking an optional ref-lookup callback —
`serializeWithoutConst = buildSerialize(noRef)`, and `serializeWithConst`
supplies a ref-lookup closure that substitutes `c<N>` references. What
remains of this section is extracting a shared walker between JSON's
`serialize` (`fjs/media/json/module.f.mjs:52`) and DJS's `buildSerialize`.

A `serializeValue` factory (in `json/serializer`) parameterized by the extra
`typeof` cases and an optional pre-`f` hook covers all three call sites.

This serializer sub-task is independent of the exact-number parser dependency
above and may land separately.

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
