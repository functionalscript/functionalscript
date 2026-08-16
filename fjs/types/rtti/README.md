# Run-time Type Information (RTTI)

See https://en.wikipedia.org/wiki/Run-time_type_information.

A type-safe schema system for describing TypeScript types at runtime and validating unknown values against them.

## Modules

- `module.f.mjs` — schema construction: defines `Type`, `Info`, and schema builder values
- `ts/module.f.mjs` — type-level transformer: `Ts<T>` maps a schema to its TypeScript type
- `common/module.f.mjs` — shared kernel for runtime consumers: error shape, path
  bookkeeping, primitive checks, and `match` (the flat `Kind` recognizer)
- `parse/module.f.mjs` — runtime deserialization: `parse(schema)(value)` returns
  a freshly constructed value containing only the declared fields/elements.
  This is *the* way to read a runtime value against a schema; there is no
  separate validator that returns its argument unchanged
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

### Structs and tuples are open

A value carrying more than the schema declares is accepted. `parse` then
constructs a fresh value holding exactly what the schema declares, so the
extras are accepted on the way in and simply absent on the way out:

| schema | value | `parse` |
| --- | --- | --- |
| `{ a: 42 }` | `{ a: 42, b: 'x' }` | `{ a: 42 }` |
| `[42]` | `[42, 'extra']` | `[42]` |
| `[number, option(string)]` | `[42]` | `[42, undefined]` |
| `[42]` | `[]` | error |

The last two rows are one rule, applied to both kinds: an absent member reads
as `undefined`, so a member is **required exactly when its set excludes
`undefined`**. Position 1 of `[number, option(string)]` admits `undefined`, so
a shorter array is fine and the gap is filled; `42` excludes it, so position 0
of `[42]` is required and `[]` fails. This is the same rule the data form
states for object keys.

Openness is what makes `parse` forward-compatible: a schema keeps reading a
serialization format that has grown fields.

**A schema that wants exact members says so** — see
[close-type.md](./todo/close-type.md) for the planned `close` form. Closedness
is stated, never inferred.

#### This is deliberate; please do not "fix" it

The tempting mistake is to read `Ts<T>` and conclude tuples must be exact:
`Ts<readonly [42]>` is the exact tuple `readonly [42]`, so a 2-element array is
not assignable to it. That was the reasoning behind an exact-length check added
in #1622 and removed again when the validator it lived in was deleted.

The argument does not hold. The open mapping in `TupleTs`
(`ts/types.ts`) is commented out because TypeScript could not handle it, not
because open tuples were rejected on design grounds. TypeScript's
expressiveness does not define the value model — a schema describes a set of
values, `Ts<T>` renders that set into TypeScript as well as TypeScript allows,
and where it cannot, `Ts<T>` is what is incomplete.

`parse/proof.f.mjs` pins openness on both kinds.

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
import { parse } from './parse/module.f.mjs'
import type { Ts } from './ts/types.ts'

const person = { name: string, age: number }
type Person = Ts<typeof person>
// { readonly name: string, readonly age: number }

const p = parse(person)
p({ name: 'Alice', age: 30 })  // ['ok', { name: 'Alice', age: 30 }]
p({ name: 'Alice' })           // ['error', { path: ['age'], message: 'unexpected value' }]

// Open: the extra key is accepted, and absent from what `parse` builds.
p({ name: 'Alice', age: 30, admin: true })  // ['ok', { name: 'Alice', age: 30 }]

// Recursive schema
const listOfStrings = array(string)
parse(listOfStrings)(['a', 'b', 'c'])  // ['ok', ['a', 'b', 'c']]
```
