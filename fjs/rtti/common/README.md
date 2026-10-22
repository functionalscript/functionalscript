# `rtti/common` — the readers' shared kernel

[`module.f.mjs`](./module.f.mjs) holds what [`parse`](../parse/module.f.mjs)
and [`validate`](../validate/module.f.mjs) share: the error shape and its path
bookkeeping, the primitive checks, `visit` and `orVisit`, and the container
skeletons `readerOf` instantiates for both readers. Its module comment lists
each export. What a schema *means* is in [the guide](../guide/README.md); this
page keeps the implementation notes behind some of the guide's rules.

## One kernel, two readers

`validate` is not a `parse` whose result is thrown away. The two share the
kernel rather than the pass: `visit` for schema recognition, `orVisit`, the
primitive checks, and the container skeletons — `containerRead`,
`constContainerRead` and `restContainerRead`, one per container shape. Each
skeleton states its shape's read order once, and `readerOf` instantiates them
for every container kind once, so the two readers read a container in the same
order, and with the same shapes, by construction. What differs is what each
passes to `readerOf`: what it collects of the members — nothing for
`validate`, the parsed members for `parse` — and what it builds of each
container kind. The data form's `validate` ([`data`](../data/module.f.mjs)) is
the same shape over `Data`, and [`validate/proof.f.mjs`](../validate/proof.f.mjs)
pins the acceptance agreement of all three as a table so they cannot drift.

## Reading a tuple schema

A `Tuple` schema is read by **length**, so a hole in the schema is a declared
position whose schema is `undefined`
([a hole is a declared position](../guide/schemas/closed-containers/README.md#a-hole-is-a-declared-position)).
`Object.entries`, which skips holes, was the schema-form readers' entry list
until it disagreed with the data form's `for…of` on exactly those schemas.
`tupleSchemaEntries` is now the one place that says how a tuple schema is
read, and `structSchemaEntries` is its struct counterpart.

The same rule settles a tuple schema's non-index enumerable own properties.
The entry reading used to declare `foo` in `Object.assign([number], { foo: string })`
and then match it against `value[NaN]`, the property literally named `NaN`,
which no ordinary value carries. The data form ignored it all along; now so do
the schema-form readers.

The mechanism is the iterator, the same one `containerUnion` walks, so the
readers and the data form agree by construction rather than by two rules that
happen to coincide. That matters only for a schema carrying an overridden
`Symbol.iterator`, which FunctionalScript cannot build, having neither symbols
nor mutation. On a dense schema with no extra own properties the two entry
lists are identical.

## The members a value carries

`undeclaredMembers` and `hasUndeclaredMember` find the members a container
schema does not declare. For a struct they are its own keys. For an array they
are its own indices below `length` (`readIndices`) and every own key that is no
index, so the walk is bounded by what the value carries rather than by
`length`: a sparse array as long as the index space allows answers at once.

Neither walk looks at the prototype chain. An earlier version walked the whole
index range and held every readable index, inherited ones included, to the
schema. Together with a presence re-check, that cost roughly 40% of validation
time on a graph of small containers, to defend against values FunctionalScript
cannot build ([what the readers assume of a
value](../guide/readers/assumptions/README.md)). An index at or above
`length` is not answered either, on any reader.

A *declared* member's presence is asked with `in` (HasProperty), because
`getItem` reads through the prototype. The two questions differ even on a
DataJS value when a struct declares a name `Object.prototype` carries:
`{ toString: or(option, number) }` refuses `{}`, since `'toString' in {}` and
the inherited function is no `number`
([`inherited-declared-member`](../todo/inherited-declared-member.md)). For
every other declared name an own member and a readable one are the same thing.

## Why a bare tuple is closed

A length check on tuples was added once, in #1622, and reverted. It was right
about the behaviour and wrong about the reason: it read `Ts<T>` as the value
model rather than the other way round. What changed since is the model. A bare
container is closed because the data form says so (its `rest` is `never`), and
`TupleTs`'s exact-length rendering follows from that
([`Ts<>` renders the closed form exactly](../guide/schemas/closed-containers/README.md#ts-renders-the-closed-form-exactly)).
