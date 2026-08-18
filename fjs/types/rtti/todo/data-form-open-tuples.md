# Make the data form's tuples open

**Priority:** P3
**Status:** open

## Problem

`parse` and the data form's `validate` disagree about the same schema.
Verified against `61e16f1`:

```js
parse([42])([42, 'extra'])             // ['ok', [42]]
validate(toData([42]))([42, 'extra'])  // ['error', { path: [], message: 'unexpected value' }]
```

Structs and tuples are open — see
[Structs and tuples are open](../README.md#structs-and-tuples-are-open) — but
`toData` maps a `Tuple` to `{ prefix }` with no `rest`, and an absent `rest`
means *closed* on arrays.

**The divergence is arrays-only.** Struct keys already agree, because the two
kinds normalize an absent `rest` against opposite identity elements
(`../data/module.f.mjs:296-320`): `arraySet` normalizes a `rest` of `never`
away, `objectSet` normalizes a `rest` of `unknown` away.

```js
parse({ a: 42 })({ a: 42, b: 'x' })             // ['ok', { a: 42 }]
validate(toData({ a: 42 }))({ a: 42, b: 'x' })  // ['ok', { a: 42, b: 'x' }]
```

This is inherited, not introduced: the exact-length rule predates the
`validate` deletion, and deleting `validate` neither caused nor fixed it. It
became visible because that PR made openness the stated model.

## Fix

Two changes, both in `../data/module.f.mjs`:

1. **`toData` maps `Tuple` to `{ prefix, rest: unknown }`** instead of
   `{ prefix }`.
2. **Drop `arraySetValidate`'s minimum-length check** (`:994-998`) in favour
   of the object rule: a position past the value's end reads as `undefined`,
   so a position is required exactly when its set excludes `undefined`.

Step 2 is needed as well as step 1. With `rest: unknown` alone, a *shorter*
array is still rejected — `arraySetValidate` requires `value.length >= pn`
whenever `rest` is present — while `parse` accepts it and fills the gap:

```js
{ prefix: [num, numOrUndef], rest: unknown }  vs  [42]            // error today
parse([number, option(string)])([42])                             // ['ok', [42, undefined]]
```

After both, "an absent member reads as `undefined`" is true of arrays and
objects alike, and `rest` defaults to open on both — the two kinds stop
disagreeing about what an absent `rest` means.

## Check before landing

- **`subset` is the thing most likely to break.** `arraySetSubset`
  (`:371-383`) reasons about admitted lengths, branching on whether each side
  has a `rest`; if every tuple gains one, the `p.rest === undefined && qn ===
  pn` arm stops being reachable the way it was. Work through it before
  changing the normalizer.
- **Canonical form must stay unique.** The data form is content-addressed, so
  if `{ prefix }` and `{ prefix, rest: unknown }` both denote the same set,
  normalization has to collapse them to one `Node` — otherwise `equal` and
  `cmp` report two spellings of one set as different.
- **`toData` output is serialized**, so this changes the on-the-wire shape of
  every tuple schema. Check whether anything stores a `Data` it will later
  compare against a freshly produced one.
- The `close` form ([close-type.md](./close-type.md)) is what will spell an
  exact-length tuple afterwards; these two should agree on which `rest` value
  means what, so land them in a compatible order.

## Tasks

- [ ] `toData`: map `Tuple` to `{ prefix, rest: unknown }`.
- [ ] `arraySetValidate`: a position past the value's end reads as
      `undefined`; drop the minimum-length check.
- [ ] Re-check `subset` / `equal` / `cmp`, especially `arraySetSubset`'s
      length reasoning and canonical collapse of the two "no rest" spellings.
- [ ] Differential: `parse(s)(v)` and `validate(toData(s))(v)` must agree on
      accept/reject for every schema/value pair, which is the property this
      issue exists to restore.
- [ ] Update `../data/README.md`'s "Tuple length" section, which currently
      documents the divergence.

## Related

- `../data/README.md` — "Tuple length", where this divergence is written down.
- `../data/module.f.mjs:296-320` — `arraySet` / `objectSet` normalization; the
  two opposite identity elements.
- [close-type.md](./close-type.md) — the explicit closed form; coordinate
  ordering.
