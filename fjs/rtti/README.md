# Run-time Type Information (RTTI)

See [run-time type information](https://en.wikipedia.org/wiki/Run-time_type_information) on Wikipedia.

A type-safe schema system for describing TypeScript types at runtime and validating unknown values against them.
The [guide](./guide/README.md) explains it one concept per page, starting
with [the schemas](./guide/schemas/README.md).

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

const person = { name: string, age: number, tags: or(option, array(string)) }
// Ts<typeof person> is
// { readonly name: string, readonly age: number, readonly tags?: readonly string[] }

parse(person)({ name: 'Ann', age: 3 })             // ['ok', …]
parse(person)({ name: 'Ann' })                      // ['error', { path: ['age'], … }]
parse(person)({ name: 'Ann', age: 3, x: 1 })        // ['error', …] — closed
parse(open(person))({ name: 'Ann', age: 3, x: 1 })  // ['ok', …] — open says so
```

The module page has a demo: pick a lesson or one of the project's own
schemas, see it drawn as a graph with its TypeScript type, JSON Schema and
canonical form, compare it with any other schema, and type a value to see
what `parse` and `validate` make of it ([`demo.f.mjs`](./demo.f.mjs)).

## Who uses it

Everything the repository reads from outside, and the compiler's own
intermediate form, is declared as a schema:

- **Protocols** — the JSON-RPC envelopes ([`protocol/json_rpc`](../protocol/json_rpc/module.f.mjs))
  and the MCP messages ([`protocol/mcp`](../protocol/mcp/module.f.mjs)): one
  declaration is both the decoder and the static type.
- **MCP tools** — the arguments of [`mcp/cas`](../mcp/cas/module.f.mjs) and
  [`mcp/evo`](../mcp/evo/module.f.mjs): one schema is both the `inputSchema`
  the server advertises and the check its arguments pass.
- **Media formats** — the [`note`](../media/note/module.f.mjs),
  [`lock`](../media/lock/module.f.mjs) and
  [`revision`](../media/revision/module.f.mjs) BLOBs, the dialect registry in
  [`media`](../media/module.f.mjs), and the JSON data model itself
  ([`media/json/rtti`](../media/json/rtti/module.f.mjs)).
- **The expression graph** — [`edag`](../edag/module.f.mjs) is its grammar
  as a schema, [`edag/value`](../edag/value/module.f.mjs) its evaluated
  values; the compiler's output is checked against it, and
  [`nanvm`](../nanvm/module.f.mjs) checks operator names with `validate`.
- **Effects** — [`effects/schema`](../effects/schema/module.f.mjs) describes
  data-shaped requests and results for validation. Its
  [`types.ts`](../effects/schema/types.ts) checks the corresponding handwritten
  TypeScript declarations against schema-derived types. These schemas are not
  a native runner ABI or the complete native effect set; that set follows
  [`effects/node/`](../effects/node/) within the
  [native scope](../../todo/nanvm-effects-node-operations.md).
- **Files the tooling reads** — generated CI workflows
  ([`ci/common`](../ci/common/module.f.mjs)) and the site's funding manifest
  ([`website/funding`](../website/funding/module.f.mjs)).
- **Responses the website reads from GitHub** — the sign-in exchange
  ([`website/github`](../website/github/module.f.mjs)) and the open pull
  requests with their checks ([`website/prs`](../website/prs/module.f.mjs)),
  declared `open` because GitHub adds fields.

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
  [The two schema-form readers](#the-two-schema-form-readers)
- `data/module.f.mjs` — the serializable data form: `toData(schema)` converts a
  thunk-form schema into a function-free, canonical representation with `cmp`,
  `equal`, `subset`, and a data-driven `validate` (see `data/README.md`)
- `demo.f.mjs` — the module page's demo: every guide page's lessons, then
  schemas the project itself uses, imported from the modules that declare
  them (its module comment describes each part)
- `schema-demo/module.f.mjs` — the demo as a factory, `schemaDemo`, over the
  examples it offers: the module page's demo and every guide page's demo are
  this one function of their lessons

## The two schema-form readers

Both walk a `Type` against an unknown value, both accept exactly the same
values, and both report the same `{ path, message }` on failure. They differ in
what a success carries:

| | `parse` | `validate` |
| --- | --- | --- |
| result on success | a freshly constructed value | the value it was given |
| undeclared member (where admitted) | accepted, absent from the result | accepted, still there |
| absent optional member | still absent | still absent |
| `Object.is(result, input)` | false for containers | true |

```js
const alice = { name: 'Alice', age: 30, admin: true }
parse(open(person))(alice)     // ['ok', { name: 'Alice', age: 30 }]
validate(open(person))(alice)  // ['ok', alice] — the same object, `admin` included
```

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
schema recognition, `orVisit`, the primitive checks, and the container
skeletons — `containerRead`, `constContainerRead` and `restContainerRead` in
`common`, one per container shape. Each skeleton states its shape's read order
once, and `readerOf` in `common` instantiates them for every container kind
once, so the two readers read a container in the same order, and with the same
shapes, by construction. What differs is what each passes to `readerOf`: what
it collects of the members — nothing for `validate`, the parsed members for
`parse` — and what it builds of each container kind. The data form's `validate`
(`data/module.f.mjs`) is the same shape over `Data`, and `validate/proof.f.mjs`
pins the acceptance agreement of all three as a table so they cannot drift.

For reading a value straight from JSON text against a schema, see
[`../media/json/todo/rtti-parse.md`](../media/json/todo/rtti-parse.md) —
one pass, no intermediate value, and it can reject `1.00000000000000001`
against a `bigint`, which no reader over an already-materialized value can do.

## What the readers assume of a value

The readers are written for **DataJS values**: plain arrays and objects of
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

What holds for any DataJS value: a reader returns a `Result` rather than throwing,
the three readers agree, and `validate` hands back the value it was given
rather than a reconstruction. A caller holding genuinely untrusted JavaScript
should convert it to DataJS first — or parse from text, where
[`../media/json/todo/rtti-parse.md`](../media/json/todo/rtti-parse.md) reads
against a schema in one pass with no intermediate value at all.
