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
`parse(s)` and `validate(s)` do.
[`validate/proof.f.mjs`](../../../validate/proof.f.mjs) runs one acceptance
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
`readonly Type[]`. The other reading would make `new Array(1)` and `[]` the
same schema while `[undefined]` stayed different from both.

A tuple schema's **non-index** properties are no positions either:
`Object.assign([number], { foo: string })` declares one position and nothing
named `foo`. On the *value* side such a key is an undeclared member like any
other, so a bare schema rejects it. How the readers walk a tuple schema is in
[`common`'s README](../../../common/README.md#reading-a-tuple-schema).

## `Ts<>` renders the closed form exactly

The exact-length tuple `TupleTs` ([`ts/types.ts`](../../../ts/types.ts))
renders **is** the closed set, so the rendering and the schema denote the same
values and `validate`'s success cast is sound: `validate([42])` never hands
back an array whose static type says `.length` is `1` while it holds two.

`Struct` is the kind TypeScript cannot render exactly: an object type is
structurally open, so `StructTs` renders a closed struct as an
**over-approximation** — every value the schema accepts inhabits the rendered
type (the cast stays sound), and the rendered type additionally admits values
the schema rejects. A static type cannot certify acceptance; that direction is
the harmless one.

[`parse/proof.f.mjs`](../../../parse/proof.f.mjs) and
[`validate/proof.f.mjs`](../../../validate/proof.f.mjs) pin closedness on both
kinds.

## Inherited members

The undeclared members a reader looks for are a value's **own** keys, and for
an array its own indices below `length`. A member only a prototype supplies,
or an index at or above `length`, is not one of them, so a closed schema does
not reject it and a `rest` does not check it. A DataJS value inherits only
what `Object.prototype` and `Array.prototype` supply, so for the values the
readers are written for the two readings agree
([what the readers assume of a
value](../../readers/assumptions/README.md)); a foreign
value is converted to DataJS at the host boundary before it reaches a reader.
The one place an inherited member shows is a *declared* name such as
`toString`, whose presence is asked through the prototype
([`inherited-declared-member`](../../../todo/inherited-declared-member.md)).

## Examples

The demo on this page runs the *Closed vs open* lesson: the value
`{"name":"Alice","age":30,"admin":true}` is refused by
`{ name: string, age: number }` and accepted by its `open` form. Pick either
schema to see its graph, its TypeScript type, its JSON Schema and the two
readers' answers, and the comparison under them reports that the closed
schema is a subset of the open one. The lesson is defined in [`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists it among all the others.

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
