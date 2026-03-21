# Run-time Type Information (RTTI)

See https://en.wikipedia.org/wiki/Run-time_type_information.

A type-safe schema system for describing TypeScript types at runtime and validating unknown values against them.

## Modules

- `module.f.ts` — schema construction: defines `Type`, `Info`, and schema builder values
- `ts/module.f.ts` — type-level transformer: `Ts<T>` maps a schema to its TypeScript type
- `validate/module.f.ts` — runtime validation: `validate(schema)(value)` returns `Result`

## Schema types

A `Type` is one of:

- **`Const`** — used directly as its own schema:
  - `Primitive` (`null`, `undefined`, `true`, `42`, `'hello'`, `7n`) — validates exact equality
  - `Tuple` (`readonly[schema, ...]`) — validates each element by position
  - `Struct` (`{ key: schema, ... }`) — validates each declared property
- **`Thunk`** (`() => Info`) — a lazy schema for tag-based and recursive types

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
import { array, record, string, number } from './module.f.ts'
import { validate } from './validate/module.f.ts'
import type { Ts } from './ts/module.f.ts'

const person = { name: string, age: number }
type Person = Ts<typeof person>
// { readonly name: string, readonly age: number }

const v = validate(person)
v({ name: 'Alice', age: 30 })  // ['ok', { name: 'Alice', age: 30 }]
v({ name: 'Alice' })           // ['error', 'unexpected value']

// Recursive schema
const listOfStrings = array(string)
validate(listOfStrings)(['a', 'b', 'c'])  // ['ok', ['a', 'b', 'c']]
```
