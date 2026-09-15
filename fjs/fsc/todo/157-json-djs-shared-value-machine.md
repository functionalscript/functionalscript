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
The grammar-based DJS tokenizer takes its grammar and its token types from
`fjs/ebnf/lib/js`, the keyword table from `fjs/js/keywords` and the
simple-escape table from `fjs/js/string_escape`, nothing from
`fjs/js/tokenizer`, and classifies characters and decodes numbers itself —
whether that remainder is worth sharing is a lexer question, not this one. The duplication tracked here is
one level up, in the **value** layer: parser, serializer, and the tokenizer's
minus-rewriter.

This issue tracks all three because they share one root cause; each part can be
landed independently.

### 1. Parser value-state machine — superseded

**This sub-task is done with, and must not be implemented.** It proposed sharing
one container-building state machine between JSON and DJS because the two were
line-for-line the same. The DJS half no longer exists: `fjs/fsc/parser` is a BNF
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

### 2. Recursive serializer walker (three, and one of them is a dump)

The same recursive `typeof`-dispatch walker over the value tree is written
three times, and the count is what is left after the old `fjs/djs/serializer`
was retired:

- `fjs/media/json/serializer/module.f.mjs` — `treeSerialize(leafSerialize)(sort)`,
  a factory. `fjs/media/json`'s `serialize` and the extended codec are two
  applications of it, not two copies.
- [`fjs/media/datajs/serializer`](../../media/datajs/serializer/module.f.mjs)
  — the format's own walk, over own property descriptors, with the ref seam
  and the `__proto__` key seam that walk alone needs now.
- [`fjs/fsc/module.f.mjs`](../module.f.mjs) — `_stringifyTree`, the dump the
  compiler's proofs pin token streams and syntax trees with: JSON's shape,
  keys sorted, over the compiler's leaves, a member holding `undefined` kept.
  It is what the old serializer's `serializeWithoutConst` was, without the
  ref and key seams, and its only readers are proofs.

So the extraction point already exists and is exported, `treeSerialize`, and
the question is whether one walker with the seams the other two need is
better than three. **The delta is four seams, not one**, and the dump needs
two of them:

```js
// json/serializer — the leaf seam runs last, and only for non-containers
const f = value => {
    if (value instanceof Array) { return arraySerialize(value) }
    if (isObject(value)) { return objectSerialize(value) }
    return leafSerialize(value)
}
```

1. **a leaf seam** — `bigint`, `undefined`, and the three non-finite
   numbers as words; the dump and DataJS both need it, and `treeSerialize`
   already has it;
2. **a pre-recursion seam** — DataJS's `$N` reference, which must run before
   container dispatch, or a shared container is written out where the
   reference belongs. Only DataJS needs it;
3. **a key seam** — `__proto__` as the exact computed form `["__proto__"]`,
   the one spelling that reads back the member. Only DataJS needs it, and
   since the old serializer went it is written once;
4. **an entry-enumeration seam** — `treeSerialize` reads an object through
   `definedEntries`, which drops a property whose value is `undefined` before
   any other seam runs; the dump reads `entries`, which keeps it, and DataJS
   reads descriptors, so that an accessor is never invoked. The dump writes
   that property today:

   ```
   {a: 1, b: undefined}  ->  {"a":1,"b":undefined}
   ```

   so reusing the JSON walker unchanged would silently discard `b`. This one is
   data loss rather than formatting, which makes it the seam most worth checking
   an implementation against.

The fourth is not an oversight in `treeSerialize`; the two families disagree
about what an `undefined` property *means*. `undefined` is a leaf of DataJS's
`Primitive`, so `{a: undefined}` is a value with a property; JSON has no such
leaf, so a `Tree<P>` property that reads `undefined` is an absent one. The
optional index signature of [`Tree<P>`](../../media/json/types.ts) — required
for soundness, since `object[key]` may be absent — is exactly what makes
"present and `undefined`" indistinguishable from "absent" at the type level, so
only the runtime enumerator can tell them apart. Any shared walker has to take
that choice as a parameter rather than inherit JSON's.

The type is not in the way: the compiler's value model is DataJS's,
[`fjs/media/datajs/types.ts`](../../media/datajs/types.ts), which
instantiates `Tree<P>` at its leaf set, so every walker here is typed over
the shape `treeSerialize` walks.

### 3. Tokenizer minus-rewriter

> Stale: the old state-machine `fjs/djs/tokenizer` this item describes was
> deleted and replaced by a grammar-based tokenizer. Re-verify current duplication
> before acting on this section.

The JSON tokenizer and the old DJS tokenizer both wrapped the shared JS
tokenizer and folded a leading `-` into the following numeric token. The JSON
tokenizer is retired — `fjs/media/json` reads its grammar and never had a
consumer of the token stream — so the fold now exists once, in
`fjs/fsc/tokenizer`, and there is nothing left to share. What this section
asked for is done by deletion.

### Tasks

- [x] **Parser sub-task: superseded**, not done — see §1. DJS no longer has a
      value-state machine to share, so there is no extraction left to make.
- [ ] JSON only: keep `NumberToken` numeric leaves through a structural parse
      rather than collapsing them to JavaScript `number` eagerly, so extended,
      standard-compatibility, and RTTI policies read one token tree. This is what
      survives of the parser sub-task, and it is not a DJS concern.
- [x] Collapse the two DJS serializer variants through an optional ref hook —
      landed as `buildSerialize` in `fjs/djs/serializer/module.f.mjs`, and
      retired with that module; the compiler's dump kept the half without
      seams.
- [ ] Extract the serializer walker independently, shared between JSON's
      `serialize`, the compiler's `_stringifyTree` and DataJS's walk — three
      consumers, and the entry-enumeration seam has to be a parameter for
      the second and third.
- [x] Whether the walker is extracted or not, give the `__proto__` key
      spelling one home — done by retiring the old serializer:
      `keySerialize` in `fjs/media/datajs/serializer` is the one.
- [ ] Re-measure the current tokenizer minus-folding duplication before extracting
      it; do not implement the stale line-number design blindly.
- [ ] Preserve current behavior/proof coverage for JSON, DataJS and the dump.
- [ ] `tsc`, `fjs t`.

### Notes

- Only extract once both consumers exist — they do here (JSON and DJS are both
  shipping). This satisfies the second-real-consumer rule.
- The old DJS serializer's `Refs` was a mutable map; if a ref table returns, prefer
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
  [`ast/types.ts`](../../fsc/ast/types.ts) carries the shape and
  [`fjs/fsc/README.md`](../../fsc/README.md) records why the list is flat, with the
  design's own `['cref', n]` / `['aref', n]` / `['array', …]` spellings visible
  in [`parser/proof.f.mjs`](../../fsc/parser/proof.f.mjs).
- `i77` (retired) — identifier property names, the DJS object-key delta. It was
  `Support for property accessor`, and its whole body was a pointer to the spec
  section plus a sketch of the operators (`instant_property`, `at`,
  `own_property`) each accessor form lowers to. The issue is gone; the section
  it pointed at survives as
  [`spec/todo/2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md).
