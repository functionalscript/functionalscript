# Read a tuple schema by length, not by enumerable entries

**Priority:** P3
**Status:** open

## Problem

A `Tuple` schema is `readonly Type[]`, and the three readers disagree about
what a **sparse** one declares. `toData` reads it by length and the schema-form
readers read it by enumerable entries, so a hole is a declared `undefined`
position to one and no position at all to the other.

- `../data/module.f.mjs`'s `containerUnion` walks the schema with
  `for (const item of c)`, which yields `undefined` for a hole and visits every
  index, so `new Array(1)` becomes the one-position prefix `[{ unit: undefined }]`.
- `../parse/module.f.mjs`'s `constContainerParse` and
  `../validate/module.f.mjs`'s `constContainerValidate` walk it with
  `Object.entries(rtti)`, which skips holes entirely, so the same schema
  declares nothing.

That breaks the agreement `../validate/proof.f.mjs` pins as a table — every
reader of a schema answers the same way. Verified against `6c609e6`, before
`close` existed, so this is not about closed containers:

| schema | value | `validate` | `parse` | data form |
| --- | --- | --- | --- | --- |
| `new Array(1)` | `[1, 2, 3]` | ok | ok | **error** |
| `[, number]` | `[9, 5]` | ok | ok | **error** |

The schema-form readers declare nothing and accept anything array-shaped; the
data form holds position 0 to `undefined` and rejects a value that has
something there. `close` reaches the same disagreement from the other side —
`close(new Array(1))` rejects `new Array(1)` and `[undefined]` in the
schema-form readers because `declared.length` is `0` while the value's length
is `1`, and the data form accepts both — but it is the same one bug, and
predates it.

Neither reader is right by construction, so the fix is a decision about what a
hole *means*, not a patch to one side.

## Proposal

**Length wins: a hole is a declared position whose schema is `undefined`.**
Reading index `0` of `new Array(1)` yields `undefined`, and `undefined` is a
`Const` schema in its own right, so the length-based reading is the one that
follows from `Tuple` being `readonly Type[]`. It is also what `toData` already
does, which keeps the canonical data form — the content-addressed one — fixed.

Give the container factories a per-kind schema-entry function, beside the
`getItem` knob they already take:

```js
const tupleSchemaEntries = rtti => Array.from(rtti, (t, i) => [String(i), t])
const structSchemaEntries = Object.entries
```

`Array.from` treats a hole as `undefined` and preserves length, so it agrees
with `containerUnion`'s `for…of` exactly, and it is identical to
`Object.entries` on a dense array — the only shape any schema in this
repository actually has. Apply it in all four factories: `constContainerParse`,
`constContainerValidate`, and the two `close` ones.

This changes open-tuple acceptance for sparse schemas, so it wants its own
changelog entry rather than riding along with an unrelated change.

The alternative — entries win, and `containerUnion` switches to
`Object.entries` — is worth stating only to reject it: it would make
`new Array(1)` and `[]` the same schema while `[undefined]` stays different
from both, which is a distinction no reader of the source could predict.

## Tasks

- [ ] Confirm the length reading is the intended meaning of a hole.
- [ ] Add the per-kind schema-entry function and use it in the four container
      factories.
- [ ] Add sparse-schema rows to `../validate/proof.f.mjs`'s acceptance table,
      which is where the disagreement should have shown up.
- [ ] Changelog entry: open tuple schemas with holes change acceptance.

## Related

- `../validate/proof.f.mjs` — the acceptance table that runs one set of rows
  through all three readers; it carries no sparse-schema row today, which is
  why this survived.
- `../data/module.f.mjs`, `containerUnion` — the length-based reading.
- `../parse/module.f.mjs`, `../validate/module.f.mjs` — the entry-based one.
- Reported by an automated reviewer on
  [PR #1687](https://github.com/functionalscript/functionalscript/pull/1687),
  which added `close`; confirmed there to predate it.
