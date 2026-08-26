# `parse` builds the members it should omit

**Priority:** P2 — the array kind's JSON round-trip is a data defect, not just
a canonicality gap
**Status:** open — the struct half needs no design; the tuple half needs a
decision (see [The tuple half is not free](#the-tuple-half-is-not-free))

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

### The tuple half is not free

The struct half costs nothing. `StructTs` already renders an
admits-`undefined` key as optional (`OptionalFields` in
[`../ts/types.ts`](../ts/types.ts)) and keeps `undefined` in the value type, so
`{ a: 1 }` and `{ a: 1, b: undefined }` are both assignable under this repo's
`exactOptionalPropertyTypes: true`. Confirmed with `npx tsc`.

The tuple half is not. `TupleTs` maps a schema tuple to a **required-length**
tuple, so `Ts<[number, option(string)]>` is `readonly [number, string | undefined]`
and the dropped result is not assignable to it:

```
error TS2322: Type '[number]' is not assignable to type 'readonly [number, string | undefined]'.
  Source has 1 element(s) but target requires 2.
```

This matters more than the approximation `TupleTs` already documents. Today
`Ts<T>` merely *understates the accepted set* — safe for a consumer of
`parse`'s result, which always inhabits the rendered type. Dropping flips the
direction: `parse`'s result would no longer inhabit its own declared type.

The target rendering is known and already shipped elsewhere: the runtime
printer emits `readonly[42,(undefined|string)?,...readonly(unknown)[]]`
(`../../../../changelog/unreleased/1680.md`), because it prints a concrete
pattern rather than mapping a generic `T`. Only the generic transformer lacks
it, the same limitation `TupleTs`'s doc comment records for the rest element.
Two candidates, both wrong:

- `{ readonly[K in keyof T]+?: Ts<T[K]> }` compiles, but marks *every* position
  optional — `[]` would then typecheck against `[42]`'s schema.
- `{ readonly[K in keyof T as undefined extends Ts<T[K]> ? K : never]+?: Ts<T[K]> }`
  does not compile: the `as` clause drops the tuple-ness, `keyof T` widens to
  `string | number | symbol`, and `T[K]` no longer satisfies `Type` (TS2344).

So the decision this issue needs first:

1. **Both kinds, with a working optional-position `TupleTs`.** The right answer
   if the derivation exists; the two failures above are what has been tried.
2. **Both kinds, accepting that `Ts<T>` overstates a tuple's length.** Cheapest,
   and it keeps one rule on both kinds — but `parse`'s result would not inhabit
   `Ts<T>`, a worse gap than the one `TupleTs` documents today. Only with the
   changelog saying so.
3. **Structs only.** Type-clean now, but it splits a rule `../README.md` states
   once for both kinds, and leaves the JSON round-trip broken on exactly the
   kind that breaks it.

## Tasks

- [ ] Decide the tuple half. The struct half is unblocked either way.
- [ ] Omit in `arrayRebuild`/`recordRebuild`: drop the key on the struct kind,
      the trailing `undefined` run on the array kind; open and closed alike.
- [ ] Settle whether `array`/`record` follow (this issue says yes).
- [ ] Attempt the optional-position `TupleTs` derivation; if it lands, `Ts<T>`
      needs no exception.
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
- [`../ts/types.ts`](../ts/types.ts) — `TupleTs` (the generic-tuple limitation)
  and `OptionalFields` (why the struct half is free).
- [sparse-tuple-schema-entries](./sparse-tuple-schema-entries.md) — the same
  "a hole and a declared `undefined` are one thing" question from the schema
  side; this one is the value side.
- [PR #1708](https://github.com/functionalscript/functionalscript/pull/1708) —
  added the acceptance rows for several trailing optional positions, which is
  where the construction side came up.
