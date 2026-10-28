## Holes in the canonical form

**Priority:** P3
**Status:** open

### Problem

Every reader refuses an array with a hole (`hasHole` in
[`common`](../common/module.f.mjs)): FunctionalScript builds no such array
([arrays](../../../spec/values/arrays/README.md)), and `parse` could rebuild
one only by shifting the positions after the hole or filling it with
`undefined`. The rest of rtti still models hole-only arrays as values, so
some of it now distinguishes sets that no value tells apart:

- **The data form and `subset`.** `toData([option])` and `toData([])` stay
  distinct, and an absence-only referenced `rest` stays a different set from
  its stripped form ([`data`'s README](../data/README.md)), although the only
  values that separated them were hole-only arrays. `subset` stays sound but
  answers `false` for some pairs whose sets are now equal.
- **`Ts<>`.** A `rest` tail renders as `...(Ts<r> | undefined)[]` because a
  hole past the prefix read `undefined`
  ([open containers](../guide/schemas/open-containers/README.md)).

### Direction

Treat an array position as absent only past the end, everywhere: normalize
the data form so that `[option]` and `[]` are one canonical form, let
`subset` follow, and render a `rest` tail without `| undefined`. (The
readers' own length bound for a `rest`, `emptyRest`, went with the hole
refusal: an array without a hole that reaches past the prefix has a member
there.) Each is its own pull request; the
readers' agreement table in [`validate/proof.f.mjs`](../validate/proof.f.mjs)
pins that acceptance does not move.
