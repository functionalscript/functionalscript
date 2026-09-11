## Replace serialized proof expectations with structural ones

**Priority:** P4
**Status:** open

### Problem

Nineteen assertions in `fjs/djs/tokenizer/proof.f.mjs` compare a
serialization against a **string literal** instead of stating the expected
value directly — eight through `JSON.stringify(value)`, and eleven through
the proof's own `stringify`, the djs serializer's `stringifyAsTree`:

```js
assertEq(JSON.stringify(result), '[{"token":{"kind":"true"},"metadata":{"path":"a.js","line":1,"column":1}},…]')
```

Serialization is incidental here — the proof wants "is this the token stream
I expect?", not "does it serialize to this text". The string form makes
property order observable, drops `undefined`-valued properties, and forces
the reader to parse JSON in their head to see what is being claimed. The
same proof already uses `stringifyAsTree` where a token carries a `bigint`
that `JSON.stringify` cannot serialize, which is a second spelling of the
same comparison.

`assertStructurallySame` (see
`fjs/types/object/structurally_same/README.md`) is the comparison these
sites want. The classical `fjs/bnf` proofs had sixty-five more such sites and
an obstacle of their own — dispatch entries carrying optional properties as
*present with value `undefined`*, which the string form hid — and went with
that module; a token carries no such property, so the rewrite here is
mechanical.

`fjs/media/json/serializer/proof.f.mjs` compares strings too, and should
keep doing so: serialized text is that module's contract.

### Tasks

- [ ] Convert the tokenizer's `JSON.stringify` and `stringifyAsTree`
      comparisons to `assertStructurallySame` against the token values,
      `bigint` fields included.
- [ ] Leave `fjs/media/json/serializer/proof.f.mjs` as string comparisons —
      serialized text is that module's contract.
- [ ] `tsc`, `fjs t`.

### Related

- `fjs/types/object/structurally_same/README.md` — the comparison these sites
  should use, and what it does and does not promise.
- [remove-native-json](../../../media/json/todo/remove-native-json.md) —
  counts the eight direct `JSON.stringify` sites among the repository's
  `JSON.stringify` uses; the eleven through the `stringifyAsTree` alias
  are this task's alone, since that issue counts direct calls.
