# Schemas

**Status:** implemented

A schema is an ordinary immutable value. A `Type` is one of:

- **`Const`**, used directly as its own schema:
  - `Primitive` (`null`, `undefined`, `true`, `42`, `'hello'`, `7n`), which
    admits exactly itself ([constants](./constants/README.md))
  - `Tuple` (`readonly[schema, ...]`), which reads each element by position
  - `Struct` (`{ key: schema, ... }`), which reads each declared property
- **`Thunk`** (`() => Info`), a lazy schema for the built-ins and for recursive
  types

The built-in schemas are all thunks: functions that return an `Info`
descriptor. Nullary schemas (`boolean`, `string`, etc.) return a single-tag
tuple; unary schemas (`array`, `record`) return a tag and the inner type.

| Schema | Returns | Admits | Page |
| --- | --- | --- | --- |
| `boolean` | `['boolean']` | any `boolean` | [primitives](./primitives/README.md) |
| `number` | `['number']` | any `number` | [primitives](./primitives/README.md) |
| `string` | `['string']` | any `string` | [primitives](./primitives/README.md) |
| `bigint` | `['bigint']` | any `bigint` | [primitives](./primitives/README.md) |
| `unknown` | `['unknown']` | any DataJS value | [primitives](./primitives/README.md) |
| `option` | `['option']` | nothing but **absence**: `or(option, t)` is a member that may be left out | [absence](./option/README.md) |
| `or(...ts)` | `['or', ...ts]` | a value any member admits; `never` is `or()` | [unions](./unions/README.md) |
| `array(t)` | `['array', t]` | `readonly Ts<t>[]` | [arrays and records](./arrays-and-records/README.md) |
| `record(t)` | `['record', t]` | `{ readonly[K: string]: Ts<t> }` | [arrays and records](./arrays-and-records/README.md) |
| `rest(c, r)` | `['rest', c, r]` | `c`'s members, and only members of `r` besides | [open containers](./open-containers/README.md) |
| `open(c)` | `['rest', c, unknown]` | `c`'s members, and anything else | [open containers](./open-containers/README.md) |

## Pages

- [Constants](./constants/README.md): a primitive as its own schema
- [Primitives](./primitives/README.md): `boolean`, `number`, `string`,
  `bigint`, `unknown`
- [Structs and tuples are closed](./closed-containers/README.md): the members
  a container declares and no others
- [Open containers](./open-containers/README.md): `open` and `rest`
- [Absence](./option/README.md): `option`, and why it is not `undefined`
- [Unions](./unions/README.md): `or` and `never`
- [Arrays and records](./arrays-and-records/README.md): homogeneous containers
- [Recursion](./recursion/README.md): a schema that uses itself

## Planned

These TypeScript type forms have no schema yet:

- function types ([668](../../todo/668-rtti-function-types.md))
- a string type that excludes some values
  ([excluded string values](../../todo/excluded-string-values.md))
- intersections, which no todo proposes yet

## Reference

- TypeScript: [everyday types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
  and [object types](https://www.typescriptlang.org/docs/handbook/2/objects.html)
- JSON Schema: [the reference](https://json-schema.org/understanding-json-schema/reference),
  draft 2020-12, the draft `toJsonSchema` writes

## Where it is implemented

The constructors in [`module.f.mjs`](../../module.f.mjs) and the types in
[`types.ts`](../../types.ts).
