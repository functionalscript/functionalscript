# Open and closed values

**Priority:** P2
**Status:** open — investigation, do not implement from this file yet

## Problem

"Extra members are allowed" versus "extra members are forbidden" is a real,
useful distinction, and rtti already needs it for both kinds of container. It
is currently spelled three different ways, and objects and arrays default to
opposite answers, so the same question gets a different answer depending on
which kind you ask and which layer you ask it in.

Whether a container is open or closed is a property **of the value set being
described**. It should be one concept, spelled once, meaning the same thing on
objects and arrays.

### Do not take TypeScript as the authority here

`TupleTs` (`../ts/types.ts:78-80`) carries the open mapping as a comment:

```ts
export type TupleTs<T extends Tuple> =
    // readonly[...{ readonly[K in keyof T]: Ts<T[K]> }, ...readonly Unknown[]]
    { readonly[K in keyof T]: Ts<T[K]> }
```

That line is commented out because TypeScript could not handle it, not because
open tuples were rejected on design grounds. It is a tooling limitation.

PR #1622 treated the surviving closed mapping as if it were the design — it
argued from "`Ts<readonly [42]>` is the exact tuple, so a 2-element array is
not assignable to it" and made `validate` reject over-long arrays. That
reasoning promoted an accident of TypeScript's expressiveness into a rule about
FunctionalScript values, and it hardened exactly one corner of the asymmetry
described below rather than resolving it. Treat that change as a data point
about the current state, not as a settled decision. Whatever this
investigation concludes may need to revert or subsume it.

The question to answer is what the *value model* should say. TypeScript's
ability to render the answer is a separate, later concern.

## What each layer can express today

Verified by execution against `805aabe`.

| | per-position/key + closed | per-position/key + open | uniform |
| --- | --- | --- | --- |
| arrays | `Tuple` ✓ | **not expressible** | `array(t)` ✓ |
| objects | **not expressible** | `Struct` ✓ | `record(t)` ✓ |

The `Const`/`Thunk` schema form (`Type`) offers exactly two of the four
per-member corners, and the two it offers are on *opposite* sides for the two
kinds. `validate`, `parse`, and `Ts<T>` all follow it, so the gap propagates.

**The data form does not have this gap.** `ArraySet` and `ObjectSet`
(`../data/types.ts:34-55`) are both `{ members, rest? }`, and all four corners
already work, with no change to any code — `validate`, `never`, and `unknown`
from `../data/module.f.mjs`, and `num` being `{ number: true }`:

```js
validate([{}, { object: [{ props: { a: num }, rest: never }] }])({ a: 1, b: 2 })  // error  — closed object
validate([{}, { object: [{ props: { a: num } }] }])({ a: 1, b: 2 })               // ok     — open object
validate([{}, { array: [{ prefix: [num], rest: unknown }] }])([1, 2, 3])          // ok     — open tuple
validate([{}, { array: [{ prefix: [num] }] }])([1, 2, 3])                         // error  — closed tuple
```

So the data form is the layer that already got this right, and it is the
natural place to read the intended semantics off. `toData` simply cannot
*produce* two of the four, because the schema form it consumes cannot say them.

## Three concrete asymmetries to resolve

### 1. `rest` defaults to a different value per kind

Same field name, opposite identity element (`../data/module.f.mjs:296-320`):

- `arraySet`: a `rest` of `never` normalizes to absent — **absent `rest` means
  closed**.
- `objectSet`: a `rest` of `unknown` normalizes to absent — **absent `rest`
  means open**.

Both are defensible in isolation and inconsistent together. A reader who
learns `rest` on one kind learns the wrong default for the other.

### 2. Absence of a member is optional-making on objects, not on arrays

An absent object property and an absent array element both read as
`undefined`. Only the object treats that as membership — with `numOrUndef`
being `{ number: true, unit: 2 }`, the `number` kind plus the `undefined` unit
bit:

```js
{ props: { a: numOrUndef } }   vs  {}           // ok
{ prefix: [numOrUndef] }       vs  []           // error
{ prefix: [numOrUndef] }       vs  [undefined]  // ok
```

`../data/types.ts:42-44` states the object rule deliberately — "an absent
property reads as `undefined`, so a key is required exactly when its set
excludes `undefined`". Nothing states the array rule; arrays just constrain
length.

This is the asymmetry #1622 cemented: it made array length exact, so an array
position is now required even when its set admits `undefined`, while the
object key beside it is optional. If the object rule is right, the array rule
should follow it; if the array rule is right, the object rule should follow.
Picking per kind is what produced the current state.

### 3. `parse` has a fourth answer

`parse` neither accepts nor rejects extras — it reshapes, and it reshapes
differently per kind and per direction: it truncates a long array, fills a
missing trailing optional with `undefined`, drops undeclared object keys, and
errors on a missing element whose set excludes `undefined`. Whatever open and
closed come to mean, `parse` needs a stated rule derived from them rather than
four behaviors discovered case by case.

## Options to investigate

Not a menu to pick from without evidence — each needs to be worked through
against the data form's set algebra (`cmp`, `equal`, `subset`), which is the
part most likely to falsify a design.

1. **Make `rest` the single spelling, everywhere.** Both kinds already have
   the field; give it the same identity element on both, and add syntax to the
   schema form so all four corners are sayable. Cheapest in concept, but it
   forces a decision on which default flips, and flipping either one is a
   breaking change to existing schemas.

2. **Make open/closed an explicit property of the container, not a
   consequence of `rest`.** A container carries its openness; `rest`
   independently constrains whatever the openness admits. Separates two ideas
   that `rest` currently conflates — "may there be extras" and "what may the
   extras be" — at the cost of a representation where some combinations are
   redundant (`closed` with a non-`never` `rest`) and need canonicalizing.

3. **Treat a container as members plus a tail set, uniformly.** Arrays index
   the tail by position past the prefix, objects by undeclared key; closed is
   `tail = never`, open is `tail = unknown`, and everything between is a real
   constraint. This is closest to what the data form already does — it mostly
   asks whether the object default can move from `unknown` to `never`.

Whichever direction wins, the answer for objects and the answer for arrays
must be the same answer, and the `Const` schema form must be able to say all
of it.

## Things any answer must handle

- **The set algebra stays sound.** `subset` on arrays reasons about admitted
  lengths (`../data/module.f.mjs:371-383`); on objects it reasons about read
  sets per key (`:414-423`). A uniform open/closed notion must keep both
  correct, and must keep `equal`/`cmp` canonical — two spellings of the same
  set must not compare unequal.
- **Canonical forms stay unique.** The data form is content-addressed; if
  `closed` becomes expressible two ways on either kind, normalization has to
  collapse them.
- **`undefined` is a value, not an absence marker.** `[undefined]` and `[]`
  are different arrays and must stay so, whatever the rule for a missing
  trailing position.
- **Rendering into TypeScript is a consequence, not an input.** If the model
  admits an open tuple and `Ts<T>` cannot render it, that is a problem for
  `Ts<T>` to solve or to document as a known gap — see `../ts/types.ts:78-80`.
  Do not narrow the model to fit it.

## Tasks

- [ ] Decide the value-model answer for open vs closed, identically for
      objects and arrays, independently of what `Ts<T>` can express.
- [ ] Decide asymmetry 2: does a member whose set admits `undefined` make that
      slot optional on both kinds, or on neither?
- [ ] Derive `parse`'s rule from the answer instead of leaving it per-case.
- [ ] Check the chosen model against `subset`/`equal`/`cmp` before writing any
      code — the set algebra is where a wrong answer shows up.
- [ ] Only then: extend the `Const`/`Thunk` schema form so all four corners
      are sayable, and reconcile `validate` (including whether #1622's length
      check survives) and `parse`.
- [ ] State the resulting rule once in `../README.md`, replacing the "Tuples
      are closed, structs are open" section, which describes the current state
      rather than an intended design.

## Related

- `../data/types.ts:22-55` — `ArraySet` / `ObjectSet`, the one place the two
  kinds already share a shape.
- `../data/module.f.mjs:296-320` — `arraySet` / `objectSet` normalization,
  where the two defaults are set.
- `../data/README.md` — "Tuple length" and the object read-set rules.
- `../ts/types.ts:78-80` — the commented-out open-tuple mapping.
- `../README.md` — "Tuples are closed, structs are open"; to be replaced by
  whatever this settles.
- `../../../djs/todo/663-json-djs-tree-type.md` — shares the recursive
  container shape between json and djs; a change to what a container *is*
  should land in a compatible order with it.
