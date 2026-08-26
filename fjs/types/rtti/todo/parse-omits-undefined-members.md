# `parse` builds the members it should omit

**Priority:** P2 — the array kind's JSON round-trip is a data defect, not just
a canonicality gap
**Status:** open — both halves are now unblocked; what remains is the change
itself (see [The type-level obstacle is gone](#the-type-level-obstacle-is-gone))

## Problem

RTTI has one rule for absence, stated in [`../README.md`](../README.md) for
both container kinds: an absent member reads as `undefined`, so **a member is
required exactly when its set excludes `undefined`**. Absence *is* `undefined`
— the two are one thing, which is why `[number, option(string)]` accepts
`[42]` and `{ a: number, b: option(string) }` accepts `{ a: 1 }`.

`parse` reads that rule on the way in and then contradicts it on the way out.
It materializes the member it just decided was absent (verified at `d24983a`):

| schema | value | `parse` builds |
| --- | --- | --- |
| `[number, option(string)]` | `[42]` | `[42, undefined]` |
| `{ a: number, b: option(string) }` | `{ a: 1 }` | `{ a: 1, b: undefined }` |
| `close([number, option(string)])` | `[1]` | `[1, undefined]` |

Both spellings denote the same RTTI value, and `parse` picks the one that
spells absence as a present member. `validate` has nothing to pick — it returns
what it was handed — so the disagreement is `parse`'s alone.

### It breaks a JSON round-trip on the array kind

JSON has no `undefined`, and an array element that holds one serializes as
`null`. So the value `parse` builds does not survive the format it was most
likely read from:

```js
const s = [number, option(string)]
parse(s)([42])                      // ['ok', [42, undefined]]
JSON.stringify([42, undefined])     // '[42,null]'
parse(s)([42, null])                // ['error', { path: ['1'], message: 'no match' }]
```

The omitted spelling round-trips: `'[42]'` re-parses to `['ok', [42, undefined]]`.

The struct kind happens to work, because `JSON.stringify` already drops a key
whose value is `undefined` — it applies the very rule this issue asks `parse`
to apply. So today the two kinds disagree about their own output in a way
nothing in the module states, and the kind that disagrees loses data.

The same follows for any format without `undefined` (CBOR, and the canonical
byte-level forms `../../../cas` hashes): two values that are equal under RTTI
serialize differently, so they address differently.

## Proposal

**Omit, don't materialize.** A parsed member whose value is `undefined` is not
written into the result.

- **Struct kind** — drop the key. `parse({ a: number, b: option(string) })({ a: 1 })`
  builds `{ a: 1 }`, and `'b' in result` is false.
- **Tuple kind** — drop the **trailing run** only. An interior position cannot
  be dropped without shifting the positions after it, so an interior
  `undefined` stays an explicit element: `[number, option(string), number]`
  against `[1, undefined, 3]` builds `[1, undefined, 3]` unchanged, while
  `[number, bigint, option(string), option(null)]` against `[2, 4n]` builds
  `[2, 4n]`.
- The closed forms follow, building their declared members exactly as the open
  ones do.

Where it lands: `arrayRebuild` and `recordRebuild` in
[`../parse/module.f.mjs`](../parse/module.f.mjs) are the two rebuild functions
all the container factories share, so each kind changes in one place.

Two cases the implementation must answer rather than discover, both settled by
the same rule — `undefined` is absence, whatever put it there:

- A member whose *input* is explicitly `undefined` (`{ a: 1, b: undefined }`)
  and a member declared with a set that is only `undefined` (`{ a: undefined }`,
  or a `close({ a: unknown })` whose `a` is `undefined`) are dropped too.
- `array`/`record` share those rebuilds, so the rule reaches them unless it is
  gated per kind. Uniform is the position this issue takes — `ArrayTs` is an
  unbounded `ReadonlyArray` and `RecordTs`'s keys are already optional, so
  neither costs anything at the type level — but it is a decision, not a
  side effect to leave unstated.

### The type-level obstacle is gone

Both halves are now free at the type level.

The struct half always was. `StructTs` renders an admits-`undefined` key as
optional (`OptionalFields` in [`../ts/types.ts`](../ts/types.ts)) and keeps
`undefined` in the value type, so `{ a: 1 }` and `{ a: 1, b: undefined }` are
both assignable under this repo's `exactOptionalPropertyTypes: true`.

The tuple half was the blocker: `TupleTs` mapped a schema tuple to a
**required-length** tuple, so a dropped result would not have inhabited its own
declared type —

```
error TS2322: Type '[number]' is not assignable to type 'readonly [number, string | undefined]'.
  Source has 1 element(s) but target requires 2.
```

`TupleTs` now renders the trailing admits-`undefined` positions optional, so
`Ts<[number, bigint, option(boolean), option(string)]>` is
`readonly[number, bigint, (boolean|undefined)?, (string|undefined)?]` and both
spellings — `[1, 2n]` and `[1, 2n, undefined, undefined]` — inhabit it. The
derivation and the three errors it had to defeat are in `TupleTs`'s doc
comment; `_tupleOption` and `_tupleInteriorOption` pin the rendering.

That was the one thing this issue needed decided before it could proceed. What
is left is the change itself, plus one question it does not settle:
`array`/`record` share `parse`'s rebuilds, so the rule reaches them unless it
is gated per kind (this issue says uniform — `ArrayTs` is an unbounded
`ReadonlyArray` and `RecordTs`'s keys are already optional, so neither costs
anything at the type level).

Only the *trailing* run renders optional, because TypeScript forbids a required
element after an optional one. That is a spelling limit, not a narrower set: an
interior position admitting `undefined` may still be absent at runtime, and
`../validate/proof.f.mjs`'s `optionalPositions` pins exactly that.

## Tasks

- [x] Decide the tuple half — `TupleTs` renders trailing omittable positions
      optional, so neither kind is blocked at the type level any more.
- [ ] Omit in `arrayRebuild`/`recordRebuild`: drop the key on the struct kind,
      the trailing `undefined` run on the array kind; open and closed alike.
- [ ] Settle whether `array`/`record` follow (this issue says yes).
- [ ] `../README.md`: the two-readers table row "absent optional member"
      (`parse`: "present as `undefined`") and the openness row
      `[number, option(string)] | [42] | [42, undefined]`.
- [ ] The proofs that pin the current spelling:
      `../parse/proof.f.mjs`'s `shortArrayFillsAnOptionalPosition` and the
      closed `shortArray`, and `../validate/proof.f.mjs`'s
      `absentOptionalStaysAbsent`, whose contrast assertion is
      `'b' in unwrap(parse(schema)(input))`.
- [ ] Add the JSON round-trip above as a proof case, so the defect cannot
      return unnoticed.
- [ ] Changelog: **BREAKING** — `parse` no longer materializes an absent
      optional member.

## Related

- [`../parse/module.f.mjs`](../parse/module.f.mjs) — `arrayRebuild` /
  `recordRebuild`, the two rebuild points.
- [`../README.md`](../README.md) — "Structs and tuples are open" states the
  absence rule this issue applies to construction, and "The two schema-form
  readers" tabulates the row that changes.
- [`../ts/types.ts`](../ts/types.ts) — `TupleTs` (the optional-position
  derivation, and the errors it defeats) and `OptionalFields` (the struct
  half's).
- The same "a hole and a declared `undefined` are one thing" question from the
  *schema* side, which this issue asks from the *value* side. It shipped as
  [#1712](https://github.com/functionalscript/functionalscript/pull/1712) —
  `parse` and `validate` read a tuple schema by length, so a hole in one is a
  declared position whose schema is `undefined`. That settles the schema side
  in favour of the reading this issue assumes, and leaves
  [schema-walk-own-indices](./schema-walk-own-indices.md) as what remains of
  it: whether that walk goes by own indices or by iteration.
- [PR #1708](https://github.com/functionalscript/functionalscript/pull/1708) —
  added the acceptance rows for several trailing optional positions, which is
  where the construction side came up.
