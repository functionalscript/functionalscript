# Thunk-direct validators accept extra tuple elements

**Priority:** P4
**Status:** open

## Problem

`validate` and `parse` walk a tuple schema's *entries*, so a value with more
elements than the schema declares passes:

```js
validate([42])([42, 'extra']) // ['ok', [42, 'extra']]
```

This is deliberate and tested today (`proof.const.tuple.extraItems` in
[`validate/proof.f.mjs`](../validate/proof.f.mjs)) and mirrors the open
handling of extra *keys* on structs. But the two cases are not symmetric:

- For structs, extra keys match TypeScript's structural typing — a value of
  type `{ readonly a: 42 }` may carry more properties.
- For tuples, `Ts<readonly [42]>` is the exact tuple `readonly [42]`; a
  3-element array is *not* assignable to it. The open-tuple mapping
  (`readonly [...T, ...readonly Unknown[]]`) exists only as a commented-out
  alternative in [`ts/types.ts`](../ts/types.ts).

The data form ([`data/module.f.mjs`](../data/module.f.mjs)) constrains tuple
length exactly — `{ prefix }` with no `rest` admits only `prefix.length`
elements — following `Ts<T>` and the set-theoretic reading ("a tuple is an
array whose length is constrained"). So the two validators currently disagree
on `validate([42])([42, 'extra'])`.

## Proposal

Make the thunk-direct `validate`/`parse` reject arrays longer than the tuple
schema (one length check in `constContainerValidate`'s tuple instantiation and
its `parse` counterpart), update `extraItems` proofs to expect an error, and
state the struct/tuple asymmetry in the rtti `README.md`. Alternatively, if
open tuples are the intended semantics, switch `TupleTs` to the open mapping
and relax the data form instead — but exact length is the reading consistent
with TypeScript.

## Related

- [`data/README.md`](../data/README.md) — "Tuple length".
