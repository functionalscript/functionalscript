# Run-time Type Information (RTTI)

See https://en.wikipedia.org/wiki/Run-time_type_information.

A type-safe schema system for describing TypeScript types at runtime and validating unknown values against them.

## Modules

- `module.f.mjs` — schema construction: defines `Type`, `Info`, and schema builder values
- `ts/module.f.mjs` — type-level transformer: `Ts<T>` maps a schema to its TypeScript type
- `common/module.f.mjs` — shared kernel for runtime consumers: error shape, path
  bookkeeping, primitive checks, and `visit`/`orVisit` (the `Type` dispatchers)
- `parse/module.f.mjs` — runtime deserialization: `parse(schema)(value)` returns
  a freshly constructed value containing only the declared fields/elements
- `validate/module.f.mjs` — runtime validation: `validate(schema)(value)`
  returns the *original* value on success. Same acceptance as `parse`, so the
  two differ only in what a success carries — see
  [The two schema-form readers](#the-two-schema-form-readers)
- `data/module.f.mjs` — the serializable data form: `toData(schema)` converts a
  thunk-form schema into a function-free, canonical representation with `cmp`,
  `equal`, `subset`, and a data-driven `validate` (see `data/README.md`)

## The two schema-form readers

Both walk a `Type` against an unknown value, both accept exactly the same
values, and both report the same `{ path, message }` on failure. They differ in
what a success carries:

| | `parse` | `validate` |
| --- | --- | --- |
| result on success | a freshly constructed value | the value it was given |
| undeclared member | accepted, absent from the result | accepted, still there |
| absent optional member | present as `undefined` | still absent |
| `Object.is(result, input)` | false for containers | true |

`parse` is the reader for a value coming *in* — from JSON, from a protocol
frame — where a value built to the schema is what the caller wants next, and
where dropping what the schema does not name is a feature.

`validate` is the reader for a value the caller already holds and must keep. A
content-addressed document is the clear case: its bytes are its identity, so a
reconstruction is a different document under a different hash, and "the payer
did not report this figure" (absent) is not "the payer reported nothing here"
(present, `undefined`). Answering "is this a `T`?" must not edit the thing
being asked about. Being open, `validate` also lets a consumer check the part
it understands without discarding the part it does not.

Neither is more fundamental than the other; `validate` is not a `parse` whose
result is thrown away. It shares the kernel rather than the pass: `visit` for
schema recognition, `eachEntry` in the no-accumulator mode `common` documents
for pass/fail callers, `orVisit`, and the primitive checks. The data form's
`validate` (`data/module.f.mjs`) is the same shape over `Data`, and
`validate/proof.f.mjs` pins the acceptance agreement with `parse` as a table so
the two cannot drift.

For reading a value straight from JSON text against a schema, see
[`../../media/json/todo/rtti-parse.md`](../../media/json/todo/rtti-parse.md) —
one pass, no intermediate value, and it can reject `1.00000000000000001`
against a `bigint`, which no reader over an already-materialized value can do.

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
extras are accepted on the way in and simply absent on the way out; `validate`
accepts the same values and returns each one as it came:

| schema | value | `parse` | `validate` |
| --- | --- | --- | --- |
| `{ a: 42 }` | `{ a: 42, b: 'x' }` | `{ a: 42 }` | `{ a: 42, b: 'x' }` |
| `[42]` | `[42, 'extra']` | `[42]` | `[42, 'extra']` |
| `[number, option(string)]` | `[42]` | `[42, undefined]` | `[42]` |
| `[42]` | `[]` | error | error |

The last two rows are one rule, applied to both kinds: an absent member reads
as `undefined`, so a member is **required exactly when its set excludes
`undefined`**. Position 1 of `[number, option(string)]` admits `undefined`, so
a shorter array is fine — `parse` fills the gap in what it builds, `validate`
has nothing to fill — while `42` excludes it, so position 0 of `[42]` is
required and `[]` fails for both. This is the same rule the data form states
for object keys.

Openness is what makes both readers forward-compatible: a schema keeps reading
a serialization format that has grown fields.

The data form says the same thing in its own vocabulary — a struct's
undeclared keys are unconstrained, a tuple's `rest` is `unknown` — so
`validate(toData(s))` accepts exactly what `parse(s)` and `validate(s)` do.
`validate/proof.f.mjs` runs one acceptance table through all three readers.

**A schema that wants exact members says so** — see
[Closed containers](#closed-containers) below. Closedness is stated, never
inferred.

#### A hole is a declared position

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
these rows; `tupleSchemaEntries` in `common/module.f.mjs` is now the one place
that says how a tuple schema is read, and `structSchemaEntries` is its struct
counterpart. The alternative reading would make `new Array(1)` and `[]` the
same schema while `[undefined]` stayed different from both.

The same rule settles a tuple schema's **non-index** enumerable own properties,
which are no positions either. `Object.assign([number], { foo: string })`
declares one position and nothing named `foo`: a tuple is read by index, so the
entry reading declared `foo` and then matched it against `value[NaN]` — the
property literally named `NaN`, which no ordinary value carries. The data form
ignored it all along; now so do the schema-form readers.

Nothing about a dense schema changes: on an array with neither holes nor extra
own properties the two entry lists are identical.

#### This is deliberate; please do not "fix" it

The tempting mistake is to read `Ts<T>` and conclude tuples must be exact:
`Ts<readonly [42]>` is the exact tuple `readonly [42]`, so a 2-element array is
not assignable to it. That was the reasoning behind an exact-length check added
in #1622 and removed again with the module it lived in. The restored
`validate` has no length check either: it is open on both kinds, exactly as
`parse` is.

The argument does not hold. The open mapping in `TupleTs`
(`ts/types.ts`) is commented out because TypeScript could not handle it, not
because open tuples were rejected on design grounds. TypeScript's
expressiveness does not define the value model — a schema describes a set of
values, `Ts<T>` renders that set into TypeScript as well as TypeScript allows,
and where it cannot, `Ts<T>` is what is incomplete.

Concretely: **`Struct`'s open-ness is free, `Tuple`'s is not**, and that
asymmetry is TypeScript's, not this renderer's. An object type is
structurally open in TypeScript by default — a wider object is assignable to
a narrower one — so `StructTs` already renders `Struct` openly with no extra
work. A tuple type is exact-length by default, and expressing "these
positions, plus anything after" needs a rest element applied *generically*
over an arbitrary schema tuple `T`; that specific derivation is what
TypeScript can't carry through (`TupleTs`'s doc comment has the two concrete
errors). So `Ts<T>` renders `Tuple` closed even though the schema is open —
one kind needed no workaround, the other has none.

`parse/proof.f.mjs` and `validate/proof.f.mjs` pin openness on both kinds.

### Closed containers

`close(c)` is the counterpart: the members `c` declares and no others.
`close(c, rest)` states the middle ground — those members, plus any number of
members belonging to `rest`.

| schema | admits |
| --- | --- |
| `[number]` | any array whose position 0 is a number |
| `close([number])` | arrays of exactly one number |
| `close([number], string)` | one number, then any number of strings |
| `{ a: number }` | any object whose `a` is a number |
| `close({ a: number })` | objects with `a` and no other key |
| `close({ a: number }, string)` | `a`, plus any number of string-valued keys |

Three things follow from stating it this way rather than inferring it.

**It needs no new concept underneath.** The data form's array and object sets
are both `{ members, rest? }` already, so `close` is the schema-form spelling of
a `rest` that form has always carried: `unknown` is openness, `never` is the
exact-members set, and a stated `rest` is itself. `close(c, unknown)` therefore
normalizes back to the bare `c` — the same `Node`, the same acceptance — and
`close(c)` and `close(c, undefined)` are one spelling. A container whose
undeclared members must be the *value* `undefined` states that rest as a wrapped
const, `() => ['const', undefined]`.

**It narrows acceptance, not construction.** `parse` builds the declared
members and nothing else, exactly as it does for the open form; a member
matching a `rest` is checked on the way in and absent on the way out. `rest`
says what an undeclared member must be, not that the reader should keep it —
the reader that keeps every member is `validate`, which returns the value it was
given here as everywhere else.

**`Ts<T>` renders `close(c)` exactly, and drops a `rest`.** The exact-length
tuple `TupleTs` settles for as an approximation of the open form *is* the closed
form, so the closed rendering is the accurate one. A `rest` has no generic
rendering (see `TupleTs`'s two TypeScript errors) and is left out; that costs
nothing for `parse`, whose result is the declared members either way. The
runtime printer goes through the data form and renders both.

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
| `close(c, rest?)` | `['close', c, rest]` | `c`'s members, and only members of `rest` besides |

## Example

```ts
import { array, record, string, number } from './module.f.mjs'
import { parse } from './parse/module.f.mjs'
import { validate } from './validate/module.f.mjs'
import type { Ts } from './ts/types.ts'

const person = { name: string, age: number }
type Person = Ts<typeof person>
// { readonly name: string, readonly age: number }

const p = parse(person)
p({ name: 'Alice', age: 30 })  // ['ok', { name: 'Alice', age: 30 }]
p({ name: 'Alice' })           // ['error', { path: ['age'], message: 'unexpected value' }]

// Open: the extra key is accepted, and absent from what `parse` builds.
p({ name: 'Alice', age: 30, admin: true })  // ['ok', { name: 'Alice', age: 30 }]

// `validate` accepts the same values and hands back what it was given.
const v = validate(person)
const alice = { name: 'Alice', age: 30, admin: true }
v(alice)      // ['ok', alice] — the same object, `admin` included
v({ name: 'Alice' })  // ['error', { path: ['age'], message: 'unexpected value' }]

// Recursive schema
const listOfStrings = array(string)
parse(listOfStrings)(['a', 'b', 'c'])  // ['ok', ['a', 'b', 'c']]
```
