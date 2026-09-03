# Run-time Type Information (RTTI)

See https://en.wikipedia.org/wiki/Run-time_type_information.

A type-safe schema system for describing TypeScript types at runtime and validating unknown values against them.

## Why `fjs/rtti/` rather than `fjs/types/rtti/`

`rtti` used to live under `fjs/types/`, but it is a peer of `djs` — `djs` the
data model, `rtti` the types described over it — not a member of `types/`.
Nothing under `types/` imports it; every consumer (`media`, `protocol`, `mcp`,
`edag`, `ci`, `emergent_testing`) is a peer of `types/`, the same relationship
every outside consumer of `types/list`, `types/result` or `types/object` has.
It does depend on several `types/*` modules (`object`, `result`, `list`,
`array`, `ts`, `phantom`), but that is consumption, not membership — the rest
of `fjs/` depends on those the same way. Its own outward dependencies
(`fjs/asserts`, `fjs/js/keywords`, `fjs/djs`) point sideways to other
top-level directories rather than down to a foundation `types/` sits under,
unlike the `types/*` modules that do reach outside (`bigint`, `bit_vec`,
`number`, `prime_field`, `string` → `fjs/common/monoid`; `uint8array` →
`fjs/text`). At 5789 lines it was also the largest thing filed under
`types/` — bigger than every sibling there and larger than every top-level
`fjs/` directory except `types` and `media` — while its siblings under
`types/` are single data structures and type-level helpers.

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
| undeclared member (where admitted) | accepted, absent from the result | accepted, still there |
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
being asked about. Against an `open` schema, `validate` also lets a consumer
check the part it understands without discarding the part it does not.

Neither is more fundamental than the other; `validate` is not a `parse` whose
result is thrown away. It shares the kernel rather than the pass: `visit` for
schema recognition, `eachEntry` in the no-accumulator mode `common` documents
for pass/fail callers, `orVisit`, and the primitive checks. The data form's
`validate` (`data/module.f.mjs`) is the same shape over `Data`, and
`validate/proof.f.mjs` pins the acceptance agreement with `parse` as a table so
the two cannot drift.

For reading a value straight from JSON text against a schema, see
[`../media/json/todo/rtti-parse.md`](../media/json/todo/rtti-parse.md) —
one pass, no intermediate value, and it can reject `1.00000000000000001`
against a `bigint`, which no reader over an already-materialized value can do.

## What the readers assume of a value

The readers are written for **DJS values**: plain arrays and objects of
primitives, the values FunctionalScript itself can build. Reading a member of
one of those has no effect, and every guarantee the readers make rests on that.

This is the language's assumption, not one the readers add. `fjs/AGENTS.md`
§3.1 "One realm, one prototype chain" says a value an `.f.mjs` function sees
was built by this realm's constructors, and §1.6 says the readers are not
proven against anything else. A value carrying a getter, a `Proxy` trap or a
replaced prototype is not such a value, and keeping one from reaching a reader
is the host boundary's job — the thin `.mjs` that converts a foreign value
before any `.f.mjs` sees it — not a defence each reader re-implements.

So the readers ask each question once and trust the answer: a container's
shape is settled before its members are read, a tuple's positions are its own
indices below `length`, and nothing is re-asked afterwards. Defending against
values the language cannot produce cost speed on every value it can — the
prototype-chain walk for inherited indices and the presence re-check together
accounted for roughly 40% of validation time on a graph of small containers.

What holds for any DJS value: a reader returns a `Result` rather than throwing,
the three readers agree, and `validate` hands back the value it was given
rather than a reconstruction. A caller holding genuinely untrusted JavaScript
should convert it to DJS first — or parse from text, where
[`../media/json/todo/rtti-parse.md`](../media/json/todo/rtti-parse.md) reads
against a schema in one pass with no intermediate value at all.

## Schema types

A `Type` is one of:

- **`Const`** — used directly as its own schema:
  - `Primitive` (`null`, `undefined`, `true`, `42`, `'hello'`, `7n`) — validates exact equality
  - `Tuple` (`readonly[schema, ...]`) — validates each element by position
  - `Struct` (`{ key: schema, ... }`) — validates each declared property
- **`Thunk`** (`() => Info`) — a lazy schema for tag-based and recursive types

### Structs and tuples are closed

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
`parse(s)` and `validate(s)` do. `validate/proof.f.mjs` runs one acceptance
table through all three readers.

**A schema that admits more says so** — see [Open containers](#open-containers)
below. What a container admits beyond what it declares is stated, never
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

#### `Ts<>` renders the closed form exactly

The exact-length tuple `TupleTs` (`ts/types.ts`) renders **is** the closed set,
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

`parse/proof.f.mjs` and `validate/proof.f.mjs` pin closedness on both kinds.

#### Beyond `length`

A tuple's members are the indices below `length`, including ones the
**prototype** supplies rather than the value's own entries — `undeclaredMembers`
in `common/module.f.mjs` walks the range and holds each readable index to the
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

### Open containers

`open(c)` is the counterpart: the members `c` declares, plus anything else.
`rest(c, r)` states the middle ground — those members, plus any number of
members belonging to `r`.

| schema | admits |
| --- | --- |
| `[number]` | arrays of exactly one number |
| `open([number])` | any array whose position 0 is a number |
| `rest([number], string)` | one number, then any number of strings |
| `{ a: number }` | objects with `a` and no other key |
| `open({ a: number })` | any object whose `a` is a number |
| `rest({ a: number }, string)` | `a`, plus any number of string-valued keys |

Openness is what makes a reader forward-compatible: a schema that says `open`
keeps reading a serialization format that has grown fields. So a schema read
against a wire format someone else may extend says `open`, and one describing a
closed vocabulary — an ADT's nodes, a tool's arguments — does not. The protocol
and media modules say `open` with the reason written beside them; `edag` says
nothing, because its grammar claims each JS chain has exactly one spelling.

Three things follow from stating openness this way rather than inferring it.

**It needs no new concept underneath.** The data form's array and object sets
are both `{ members, rest? }` already, so `rest` is the schema-form spelling of
a `rest` that form has always carried: `never` is the bare, closed container,
`unknown` is openness, and a stated `rest` is itself. `rest(c, unknown)`
therefore normalizes to `open(c)` — the same `Node`, the same acceptance — and
`rest(c, never)` normalizes back to the bare `c`. A container whose undeclared
members must be the *value* `undefined` states that rest as a wrapped const,
`() => ['const', undefined]`.

**Both parameters of `rest` are required.** An optional one would need a
sentinel for "no undeclared member", and every candidate — `undefined` most of
all — is a `Type` in its own right, so the sentinel would collide with the
schema it spells. `never` carries no such ambiguity, and there is no overload.

**It widens acceptance, not construction.** `parse` builds the declared members
and nothing else, exactly as it does for the bare form; a member matching a
`rest` is checked on the way in and absent on the way out. `rest` says what an
undeclared member must be, not that the reader should keep it — the reader that
keeps every member is `validate`, which returns the value it was given here as
everywhere else.

**`Ts<>` renders the tail.** `RestTs` renders `rest(c, r)`'s tuple tail as
`...(Ts<r> | undefined)[]`: a hole past the prefix is no member, so a reader
skips it and the index reads `undefined`. An **empty** rest renders no tail —
`rest(c, or())` is the bare `c`, one set and so one rendering. What counts as
empty is `emptyRest`'s question in `data/module.f.mjs`, a `toData` conversion
compared with `subset` both ways, which `types.ts` cannot invoke; `RestTs`
recognizes the one directly spellable empty rest, `or()`, and keeps the tail
whenever it cannot tell. A kept tail is wider than the schema but sound, which
is the direction a success cast needs. The runtime printer goes through the data
form and recognizes the rest semantically, so the two differ on
`rest([42], [or()])` — the printer drops the tail there and `Ts<>` does not.

An **empty rest bounds an array's length**, which is the bare form's rule
arriving through the other spelling: `array(or())` is the empty array and not
"any number of holes", and `rest([42], or())` rejects `[42, , ]` exactly as
`[42]` does.

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
| `option`    | `['option']`         | nothing — **absence**: `or(option, t)` is a member that may be left out |
| `array(t)`  | `['array', t]`       | `readonly Ts<t>[]`               |
| `record(t)` | `['record', t]`      | `{ readonly[K: string]: Ts<t> }` |
| `rest(c, r)` | `['rest', c, r]` | `c`'s members, and only members of `r` besides |
| `open(c)`   | `['rest', c, unknown]` | `c`'s members, and anything else |

## Example

```ts
import { array, open, record, string, number } from './module.f.mjs'
import { parse } from './parse/module.f.mjs'
import { validate } from './validate/module.f.mjs'
import type { Ts } from './ts/types.ts'

const person = { name: string, age: number }
type Person = Ts<typeof person>
// { readonly name: string, readonly age: number }

const p = parse(person)
p({ name: 'Alice', age: 30 })  // ['ok', { name: 'Alice', age: 30 }]
p({ name: 'Alice' })           // ['error', { path: ['age'], message: 'unexpected value' }]

// Closed: the extra key is a member the schema does not name.
p({ name: 'Alice', age: 30, admin: true })  // ['error', …]

// `open` admits it, and `parse` still builds only what the schema declares.
parse(open(person))({ name: 'Alice', age: 30, admin: true })
// ['ok', { name: 'Alice', age: 30 }]

// `validate` accepts the same values and hands back what it was given.
const v = validate(open(person))
const alice = { name: 'Alice', age: 30, admin: true }
v(alice)      // ['ok', alice] — the same object, `admin` included
v({ name: 'Alice' })  // ['error', { path: ['age'], message: 'unexpected value' }]

// Recursive schema
const listOfStrings = array(string)
parse(listOfStrings)(['a', 'b', 'c'])  // ['ok', ['a', 'b', 'c']]
```
