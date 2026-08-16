# Run-time Type Information (RTTI)

See https://en.wikipedia.org/wiki/Run-time_type_information.

A type-safe schema system for describing TypeScript types at runtime and validating unknown values against them.

## Modules

- `module.f.mjs` — schema construction: defines `Type`, `Info`, and schema builder values
- `ts/module.f.mjs` — type-level transformer: `Ts<T>` maps a schema to its TypeScript type
- `common/module.f.mjs` — shared kernel for runtime consumers: error shape, path
  bookkeeping, primitive checks, and `match` (the flat `Kind` recognizer)
- `validate/module.f.mjs` — runtime validation: `validate(schema)(value)` returns
  the original value (or `Result` on error)
- `parse/module.f.mjs` — runtime deserialization: `parse(schema)(value)` returns
  a freshly constructed value containing only the declared fields/elements
- `data/module.f.mjs` — the serializable data form: `toData(schema)` converts a
  thunk-form schema into a function-free, canonical representation with `cmp`,
  `equal`, `subset`, and a data-driven `validate` (see `data/README.md`)

## Schema types

A `Type` is one of:

- **`Const`** — used directly as its own schema:
  - `Primitive` (`null`, `undefined`, `true`, `42`, `'hello'`, `7n`) — validates exact equality
  - `Tuple` (`readonly[schema, ...]`) — validates each element by position
  - `Struct` (`{ key: schema, ... }`) — validates each declared property
- **`Thunk`** (`() => Info`) — a lazy schema for tag-based and recursive types

### Tuples are closed, structs are open

A tuple's length is part of its type, a struct's key set is not, and every
runtime consumer follows `Ts<T>` on both counts:

| | extra element / key | `validate` | `parse` | data form |
| --- | --- | --- | --- | --- |
| `Tuple` | `[42, 'extra']` against `[42]` | error | dropped | not in the set |
| `Struct` | `{ a: 42, b: 'x' }` against `{ a: 42 }` | ok | dropped | in the set |

The asymmetry is TypeScript's, not a quirk of these validators.
`Ts<readonly [42]>` is the exact tuple `readonly [42]`, and a 2-element array
is not assignable to it — so `validate` rejects one. A value of type
`{ readonly a: 42 }` may carry more properties under structural typing — so
`validate` accepts one.

`parse` drops rather than rejects in both rows, and that is deliberate: it
constructs a fresh value containing only what the schema declares, which
makes it forward-compatible with a serialization format that grows fields.
Rejecting there would trade that away for nothing — the value it returns
already has the exact type.

## Built-in schemas

The built-in schemas are all `Thunk`s — functions that return an `Info` descriptor.
Nullary schemas (`boolean`, `string`, etc.) return `Info0` (a single-tag tuple);
unary schemas (`array`, `record`) return `Info1` (a tag + inner type tuple).

| Schema      | Returns              | Validates                        |
|-------------|----------------------|----------------------------------|
| `boolean`   | `['boolean']`        | any `boolean`                    |
| `number`    | `['number']`         | any `number`                     |
| `string`    | `['string']`         | any `string`                     |
| `bigint`    | `['bigint']`         | any `bigint`                     |
| `unknown`   | `['unknown']`        | any DJS value                    |
| `array(t)`  | `['array', t]`       | `readonly Ts<t>[]`               |
| `record(t)` | `['record', t]`      | `{ readonly[K: string]: Ts<t> }` |

## Example

```ts
import { array, record, string, number } from './module.f.mjs'
import { validate } from './validate/module.f.mjs'
import type { Ts } from './ts/types.ts'

const person = { name: string, age: number }
type Person = Ts<typeof person>
// { readonly name: string, readonly age: number }

const v = validate(person)
v({ name: 'Alice', age: 30 })  // ['ok', { name: 'Alice', age: 30 }]
v({ name: 'Alice' })           // ['error', { path: ['age'], message: 'unexpected value' }]

// Recursive schema
const listOfStrings = array(string)
validate(listOfStrings)(['a', 'b', 'c'])  // ['ok', ['a', 'b', 'c']]
```
