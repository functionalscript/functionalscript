# Run-time Type Information (RTTI)

See [run-time type information](https://en.wikipedia.org/wiki/Run-time_type_information) on Wikipedia.

A type-safe schema system for describing TypeScript types at runtime and validating unknown values against them.
The [guide](./guide/README.md) explains it one concept per page, in four
areas: [schemas](./guide/schemas/README.md),
[readers](./guide/readers/README.md), [outputs](./guide/outputs/README.md) and
[in the project](./guide/in-the-project/README.md).

## Why

A schema here is an ordinary immutable value, built from a few constructors,
and everything a consumer needs about a type is derived from that one value.
Nothing derived can drift from the declaration, because there is no second
declaration:

| From one schema `s` | | Where |
| --- | --- | --- |
| a decoder that builds a fresh value | `parse(s)(value)` | [`parse/`](./parse/module.f.mjs) |
| a membership check that returns the value it was given | `validate(s)(value)` | [`validate/`](./validate/module.f.mjs) |
| the static TypeScript type | `Ts<typeof s>` | [`ts/types.ts`](./ts/types.ts) |
| the TypeScript type as text | `printer()(s)`, `dataToTs()(toData(s))` | [`ts/module.f.mjs`](./ts/module.f.mjs) |
| a canonical form with `equal`, `cmp`, `subset` | `toData(s)` | [`data/`](./data/module.f.mjs) |
| a JSON Schema (draft 2020-12) | `toJsonSchema(s)` | [`../media/json/schema`](../media/json/schema/module.f.mjs) |

```js
import { array, number, open, option, or, string } from 'functionalscript/fjs/rtti/module.f.mjs'
import { parse } from 'functionalscript/fjs/rtti/parse/module.f.mjs'
import { validate } from 'functionalscript/fjs/rtti/validate/module.f.mjs'

const person = { name: string, age: number, tags: or(option, array(string)) }
// Ts<typeof person> is
// { readonly name: string, readonly age: number, readonly tags?: readonly string[] }

parse(person)({ name: 'Ann', age: 3 })             // ['ok', …]
parse(person)({ name: 'Ann' })                      // ['error', { path: ['age'], … }]
parse(person)({ name: 'Ann', age: 3, x: 1 })        // ['error', …] — closed
parse(open(person))({ name: 'Ann', age: 3, x: 1 })  // ['ok', …] — open says so
```

The [outputs area](./guide/outputs/README.md) of the guide has a page for each
row but the readers. The module page has a demo: pick a lesson or one of the
project's own schemas, see it drawn as a graph with its TypeScript type, JSON
Schema and canonical form, compare it with any other schema, and type a value
to see what `parse` and `validate` make of it ([`demo.f.mjs`](./demo.f.mjs)).

## Who uses it

Everything the repository reads from outside, and the compiler's own
intermediate form, is declared as a schema: the
[protocols](./guide/in-the-project/protocols/README.md) and MCP tools, the
[media formats](./guide/in-the-project/media/README.md) and JSON itself,
[the expression graph](./guide/in-the-project/expression-graph/README.md),
data-shaped [effects](./guide/in-the-project/effects/README.md), and the files
and responses the [tooling](./guide/in-the-project/tooling/README.md) reads.
Each of those pages names the modules and offers their schemas in its demo.

## Where it is going

[`todo/rtti-type-system.md`](../../todo/rtti-type-system.md) is the
direction: RTTI as the single source of truth for FunctionalScript's types,
checked at compile time through `//: name` annotations naming a schema, with
`.d.ts` generated rather than written. The run-time half above exists; the
compile-time half does not yet. The issues for this directory are in
[`todo/`](./todo/).

## Why `fjs/rtti/` rather than `fjs/types/rtti/`

`rtti` used to live under `fjs/types/`, but it is a peer of the modules that
hold the data model — [DataJS](../media/datajs/README.md) the model, `rtti`
the types described over it — not a member of `types/`.
Nothing under `types/` imports it; every consumer (`media`, `protocol`, `mcp`,
`edag`, `ci`, `emergent_testing`) is a peer of `types/`, the same relationship
every outside consumer of `types/list`, `types/result` or `types/object` has.
It does depend on several `types/*` modules (`object`, `result`, `list`,
`array`, `ts`, `phantom`), but that is consumption, not membership — the rest
of `fjs/` depends on those the same way. Its own outward dependencies
(`fjs/asserts`, `fjs/js/keywords`, `fjs/media/datajs`) point sideways to other
top-level directories rather than down to a foundation `types/` sits under,
unlike the `types/*` modules that do reach outside (`bigint`, `bit_vec`,
`number`, `prime_field`, `string` → `fjs/common/monoid`; `uint8array` →
`fjs/text`). It was also the largest thing filed under `types/`, while its
siblings there are single data structures and type-level helpers.

## Modules

- `guide/` — the concept pages: what a schema means, one page per concept
- `module.f.mjs` — schema construction: defines `Type`, `Info`, and schema builder values
- `ts/types.ts` — type-level transformer: `Ts<T>` maps a schema to its TypeScript type
  (see `ts/README.md`)
- `ts/module.f.mjs` — the runtime printer: a schema's TypeScript type as text,
  through the data form
- `common/module.f.mjs` — shared kernel for runtime consumers: error shape, path
  bookkeeping, primitive checks, `visit`/`orVisit` (the `Type` dispatchers),
  and the container skeletons the two schema-form readers read through
- `parse/module.f.mjs` — runtime deserialization: `parse(schema)(value)` returns
  a freshly constructed value containing only the declared fields/elements
- `validate/module.f.mjs` — runtime validation: `validate(schema)(value)`
  returns the *original* value on success. Same acceptance as `parse`, so the
  two differ only in what a success carries — see
  [`parse` and `validate`](./guide/readers/parse-and-validate/README.md)
- `data/module.f.mjs` — the serializable data form: `toData(schema)` converts a
  thunk-form schema into a function-free, canonical representation with `cmp`,
  `equal`, `subset`, and a data-driven `validate` (see `data/README.md`)
- `demo.f.mjs` — the module page's demo: every guide page's lessons, then
  schemas the project itself uses, imported from the modules that declare
  them (its module comment describes each part)
- `schema-demo/module.f.mjs` — the demo as a factory, `schemaDemo`, over the
  examples it offers: the module page's demo and every guide page's demo are
  this one function of their lessons

## Readers

`parse` builds a value from what a schema declares, `validate` hands back the
value it was given, and both accept exactly the same values. The
[readers area](./guide/readers/README.md) of the guide says what each is for,
what a refusal carries, and what the readers assume of a value.
