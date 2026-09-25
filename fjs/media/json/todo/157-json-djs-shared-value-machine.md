## 157. One serializer walker for JSON, DataJS and the compiler dump

**Priority:** P3
**Status:** open

### Problem

DataJS is a superset of JSON: every JSON value is a DataJS value, plus DataJS
adds `bigint`, `undefined`, the non-finite numbers, and references to shared
nodes. Because of that relationship the serializers should share their
value-level walk. Today they don't.

The parser half of this issue is closed: the old `fjs/djs` value-state machine
it proposed to share was deleted when `fjs/fsc/parser` became a grammar, and
JSON has one parser left. So is the tokenizer half: neither tokenizer folds a
`-` into a number any longer. What survived of the parser half was JSON-only —
keep each number exact until a policy reads it — and has shipped: the reader
hands every number's lexeme to the codec's `NumberPolicy`
([the numeric policy is the seam](../README.md#the-numeric-policy-is-the-seam-not-an-exact-tree)).

The same recursive `typeof`-dispatch walker over the value tree is written
three times, and the count is what is left after the old `fjs/djs/serializer`
was retired:

- [`../serializer/module.f.mjs`](../serializer/module.f.mjs) —
  `treeSerialize(leafSerialize)(sort)`, a factory. `fjs/media/json`'s
  `serialize` and the extended codec are two applications of it, not two
  copies.
- [`fjs/media/datajs/serializer`](../../datajs/serializer/module.f.mjs)
  — the format's own walk, over own property descriptors, with the ref seam
  and the `__proto__` key seam that walk alone needs now.
- [`fjs/fsc/module.f.mjs`](../../../fsc/module.f.mjs) — `_stringifyTree`, the
  dump the compiler's proofs pin token streams and syntax trees with: JSON's
  shape, keys sorted, over the compiler's leaves, a member holding `undefined`
  kept. It is what the old serializer's `serializeWithoutConst` was, without
  the ref and key seams, and its only readers are proofs.

So the extraction point already exists and is exported, `treeSerialize`, and
the question is whether one walker with the seams the other two need is
better than three. **The delta is four seams, not one**, and the dump needs
two of them:

```js
// treeSerialize — the leaf seam runs last, and only for non-containers
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
   since the old serializer went it is written once, `keySerialize` in
   `fjs/media/datajs/serializer`;
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
optional index signature of [`Tree<P>`](../types.ts) — required
for soundness, since `object[key]` may be absent — is exactly what makes
"present and `undefined`" indistinguishable from "absent" at the type level, so
only the runtime enumerator can tell them apart. Any shared walker has to take
that choice as a parameter rather than inherit JSON's.

The type is not in the way: the compiler's value model is DataJS's,
[`fjs/media/datajs/types.ts`](../../datajs/types.ts), which
instantiates `Tree<P>` at its leaf set, so every walker here is typed over
the shape `treeSerialize` walks.

### Tasks

- [ ] Extract the serializer walker, shared between JSON's `serialize`, the
      compiler's `_stringifyTree` and DataJS's walk — three consumers, and the
      entry-enumeration seam has to be a parameter for the second and third.
- [ ] Preserve current behavior/proof coverage for JSON, DataJS and the dump.
- [ ] `tsc`, `fjs t`.

### Notes

- Only extract once both consumers exist — they do here (JSON and DataJS are
  both shipping). This satisfies the second-real-consumer rule.
- The old DJS serializer's `Refs` was a mutable map; if a ref table returns, prefer
  threading an immutable accumulator rather than spreading mutation into the
  shared abstraction.

### Related

- [`../README.md`](../README.md) — the shared grammar reader and why its
  numeric seam is a policy rather than a materialized token tree.
- [JSON numeric edge cases](./number-edge-cases.md) — decides
  materialization for exponent overflow, oversized bare integers, and standard
  compatibility.
- [json-writer-owner](../../../fsc/todo/json-writer-owner.md) — a fourth,
  fallible JSON walker in `fjs/fsc/module.f.mjs`.
- `i003` (retired; shipped as `fjs/fsc/ast`) — the original DJS design: parse a
  module into a flat list of constants addressed by index. It landed verbatim —
  [`ast/types.ts`](../../../fsc/ast/types.ts) carries the shape and
  [`fjs/fsc/README.md`](../../../fsc/README.md) records why the list is flat, with the
  design's own `['cref', n]` / `['aref', n]` / `['array', …]` spellings visible
  in [`parser/proof.f.mjs`](../../../fsc/parser/proof.f.mjs).
- `i77` (retired) — identifier property names, the DJS object-key delta. It was
  `Support for property accessor`, and its whole body was a pointer to the spec
  section plus a sketch of the operators (`instant_property`, `at`,
  `own_property`) each accessor form lowers to. The issue is gone; the section
  it pointed at survives as
  [`spec/todo/2330-property-accessor.md`](../../../../spec/todo/2330-property-accessor.md).
