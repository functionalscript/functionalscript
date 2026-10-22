# Structs and tuples are closed

**Status:** implemented

A bare `Struct` or `Tuple` admits **the members it declares and no others**. A
value carrying more is not one of its values, on either reader:

| schema | value | `parse` | `validate` |
| --- | --- | --- | --- |
| `{ a: 42 }` | `{ a: 42, b: 'x' }` | error | error |
| `{ a: 42 }` | `{ a: 42 }` | `{ a: 42 }` | `{ a: 42 }` |
| `[42]` | `[42, 'extra']` | error | error |
| `[number, or(option, string)]` | `[42]` | `[42]` | `[42]` |
| `[42]` | `[]` | error | error |

A tuple answers by **length** as well as by member: a hole past the prefix is
no member, so `[42, , ]` would slip through a member check alone while the
array is still that long.

The last two rows are one rule, and closedness leaves it alone — it is about
*undeclared* members, and a declared position admitting **absence** stays
omittable. A member is absent when its key or index is neither an own
property nor an inherited one, and it is **required exactly when its set
excludes absence** — the `option` member of its union. Position 1 of
`[number, or(option, string)]` admits absence, so a shorter array is fine —
and neither reader materializes anything: `parse` builds `[42]`, omitting the
absent member — while `42` excludes it, so position 0 of `[42]` is required
and `[]` fails for both. Absence is not a spelling of `undefined`: `{}` and
`{ a: undefined }` are two distinct values, `or(option, t)` admits the first
and `or(t, undefined)` the second. This is the same rule the data form
states for object keys, as the `absentBit` of a member's unit bitset.

The data form says the same thing in its own vocabulary — a bare container's
`rest` is `never` on both kinds — so `validate(toData(s))` accepts exactly what
`parse(s)` and `validate(s)` do. `fjs/rtti/validate/proof.f.mjs` runs one acceptance
table through all three readers.

**A schema that admits more says so** — see
[open containers](../open-containers/README.md). What a container admits
beyond what it declares is stated, never inferred.

## A hole is a declared position

A `Tuple` schema is read by **length**, so a sparse one declares as many
positions as it is long and a hole is a position whose schema is `undefined`:

| schema | value | all three readers |
| --- | --- | --- |
| `new Array(1)` | `[undefined]` | ok |
| `new Array(1)` | `[1, 2, 3]` | error |
| `[, number]` | `[undefined, 5]` | ok |
| `[, number]` | `[9, 5]` | error |

Reading index `0` of `new Array(1)` yields `undefined`, and `undefined` is a
`Const` schema in its own right, so this is what follows from `Tuple` being
`readonly Type[]`. `Object.entries` — which skips holes — was the schema-form
readers' entry list until it disagreed with the data form's `for…of` on exactly
these rows; `tupleSchemaEntries` in `fjs/rtti/common/module.f.mjs` is now the one place
that says how a tuple schema is read, and `structSchemaEntries` is its struct
counterpart. The alternative reading would make `new Array(1)` and `[]` the
same schema while `[undefined]` stayed different from both.

The same rule settles a tuple schema's **non-index** enumerable own properties,
which are no positions either. `Object.assign([number], { foo: string })`
declares one position and nothing named `foo`: a tuple is read by index, so the
entry reading declared `foo` and then matched it against `value[NaN]` — the
property literally named `NaN`, which no ordinary value carries. The data form
ignored it all along; now so do the schema-form readers. (On the *value* side
such a key is an undeclared member like any other, so a bare schema rejects it.)

"By length" is how every schema anyone can write is read; the mechanism is the
iterator, the same one `containerUnion` walks, so the two agree by construction
rather than by two rules that happen to coincide. That matters only for a schema
carrying an overridden `Symbol.iterator` — which FunctionalScript cannot build,
having neither symbols nor mutation — where reading indices here would put the
schema-form readers back at odds with the data form.

Nothing about a dense schema changes: on an array with neither holes nor extra
own properties the two entry lists are identical.

## `Ts<>` renders the closed form exactly

The exact-length tuple `TupleTs` (`fjs/rtti/ts/types.ts`) renders **is** the closed set,
so the rendering and the schema denote the same values and `validate`'s success
cast is sound. That was not true while a bare tuple was open, and it is the
defect this default removes: `validate([42])([42, 'extra'])` used to hand back a
two-element array whose static type said `.length` was `1`.

An earlier length check, added in #1622 and reverted, was right about the
behaviour and wrong about the reason — it read `Ts<T>` as the value model rather
than the other way round. What has changed since is the model.

`Struct` is the kind TypeScript cannot render exactly: an object type is
structurally open, so `StructTs` renders a closed struct as an
**over-approximation** — every value the schema accepts inhabits the rendered
type (the cast stays sound), and the rendered type additionally admits values
the schema rejects. A static type cannot certify acceptance; that direction is
the harmless one.

`fjs/rtti/parse/proof.f.mjs` and `fjs/rtti/validate/proof.f.mjs` pin closedness on both kinds.

## Beyond `length`

A tuple's members are the indices below `length`, including ones the
**prototype** supplies rather than the value's own entries — `undeclaredMembers`
in `fjs/rtti/common/module.f.mjs` walks the range and holds each readable index to the
schema, which is what keeps `rest([42], string)` from accepting an array whose
index 1 inherits a number.

An index **at or above** `length` is not answered, on any reader, and no walk
bounded by the value reaches it: with `Array.prototype[10] = 99`,
`validate([42])([42])` is `ok` and `v[10]` reads `99`. Neither obvious remedy
settles it — a prototype-identity check closes only the per-value half, and
"check the intrinsic" is a realm-wide property that can change between the check
and the read — so this is a stated caveat rather than a rule, and it applies to
`array`, `record` and every container schema alike. It is really a question
about what the FunctionalScript subset assumes of its host.

## Examples

The [RTTI demo](../../../README.md) shows this rule in its *Closed vs open* lesson: the value
`{"name":"Alice","age":30,"admin":true}` is refused by
`{ name: string, age: number }` and accepted by its `open` form. Its *Tuple vs
rest* lesson shows the same rule on a tuple. This page gets a demo of its own
in a later step ([the plan](../../../todo/rtti-guide.md)).

## Reference

- TypeScript: [object types](https://www.typescriptlang.org/docs/handbook/2/objects.html)
  and [tuple types](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types)
- JSON Schema: `additionalProperties: false` and `items: false`, with
  `required` and `minItems` for the members a value must have
  ([object](https://json-schema.org/understanding-json-schema/reference/object),
  [array](https://json-schema.org/understanding-json-schema/reference/array))

## Where it is implemented

The container skeletons in [`common`](../../../common/module.f.mjs), read
by [`parse`](../../../parse/module.f.mjs) and
[`validate`](../../../validate/module.f.mjs); the data form's `rest` in
[`data`](../../../data/module.f.mjs).
