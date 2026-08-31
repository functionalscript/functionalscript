## One factory for a `vnd.fjs.*` JSON dialect

**Priority:** P3
**Status:** open

### Problem

"A dialect is a tag, a schema, a canonical encoder, a shape validator, an
optional semantic refinement, a decoder, and a registry entry" is one
concept, but it is spelled out verbatim in each dialect module. `revision`,
`lock`, and `note` each define the same seven-line kit:

```js
// revision/module.f.mjs:37-40, lock/module.f.mjs:45-48, note/module.f.mjs:46-49
export const dialect = /** @type {const} */ ('vnd.fjs.revision')   // .lock / .note
export const mediaType = /** @type {const} */ (`application/${dialect}+json`)

// revision :136-258, lock :77-114, note :111-129
export const encodeText = stringify(sort)
const validateShape = rttiParse(theSchema)
export const validate = value => okThen(checkReferences)(validateShape(value))  // note: no refinement
export const decodeText = text => okThen(validate)(parseJson(text))
```

plus, where a refinement exists, the same `Result → boolean` adapter twice
(`isValidRevision`, `revision/module.f.mjs:263`; `isValidLock`,
`lock/module.f.mjs:119`), feeding `dialectEntry(schema, isValid…)`.

The media-type rule is derived a **fourth** time in the registry itself:
`dialectEntry` returns only `{ dialect, match }`, so `detect` rebuilds
`` `application/${matched.dialect}+json` `` (`module.f.mjs:165`) while the
three exported `mediaType` constants are read by nothing but proofs.

A fourth dialect is already planned
([change-content-format.md](./change-content-format.md)), which would be a
fourth copy of the kit.

### Proposal

One factory in `module.f.mjs`, next to `dialectEntry`:

```js
/** Everything a `vnd.fjs.*`+json dialect derives from its schema and its
 * optional semantic refinement. */
export const jsonDialect = (schema, checkReferences) => ({
    dialect,        // read off the schema, as dialectEntry already does
    mediaType,      // `application/${dialect}+json`, stated once
    encodeText,     // stringify(sort)
    validate,       // rttiParse(schema), then okThen(checkReferences) if given
    decodeText,     // okThen(validate)(parseJson(text))
    entry,          // the DialectEntry for `detect`
})
```

It is **exported**: `revision`, `lock`, and `note` are three separate modules
that import it, so a module-private `const` would not reach them.
`dialectEntry` is already public here and the factory is the same kind of
thing, so it ships as public API with its type-level signature in
`../types.ts`. If it is judged internal instead, the linkage-only form is
`export const _jsonDialect`, per `fjs/AGENTS.md`'s rule that a private name
keeps its `_` even when module linkage requires exporting it.

**The literal types have to survive the extraction.** Each module pins its
two constants today — `export const dialect = /** @type {const} */
('vnd.fjs.revision')` and the `mediaType` built from it — while
`DialectEntry.dialect` is only `string`, so a factory whose return type is
inferred ordinarily widens both to `string` and weakens a public contract
that `fjs/AGENTS.md` says must not get weaker for being written in
JavaScript. The signature in `../types.ts` therefore carries the dialect as
a type parameter and derives the media type as a template literal:

The same applies to the rest of the kit: `encodeText`, `validate`, and
`decodeText` have per-dialect types today — `(Revision) => string`,
`(Unknown) => Result<Revision, RevisionError>` — and an inferred factory
would erase those to a common supertype. Two facts make a precise signature
straightforward rather than a guess:

- **The value type needs no parameter.** `Revision`, `Lock`, and `Note` are
  each already `Ts<typeof theSchema>` (`../revision/types.ts:52` and its
  siblings), so the factory derives the value from the schema parameter with
  the same `Ts<>` the modules use.
- **The error union turns on the refinement alone.** `note`, which has no
  `checkReferences`, types `validate` as `Result<Note, ValidationError>`;
  `revision` and `lock`, which have one, add the `string` it raises. All
  three `decodeText`s carry `string` regardless, because a JSON parse failure
  is a string error — which is exactly what `NoteError`'s "or a JSON parse
  error message" records.

So the signature is parameterized by the schema and by the refinement's error
type. `E` **defaults to `never`**, and the default is what makes `note`
correct: it calls `jsonDialect(noteSchema)` with no second argument, so
nothing infers `E`, and without the default it would land on `unknown` and
widen `note.validate` to `Result<Note, unknown>` — the opposite of the
declaration-preservation this section exists for. The factory needs the
matching runtime default (`checkReferences` optional), or a one-argument
overload:

```ts
import type { Unknown as JsonUnknown } from './json/types.ts'
import type { Rest, Struct, Type } from '../rtti/types.ts'

/** The value a dialect schema denotes. */
type ValueOf<S extends Struct> = Ts<S>

/** The dialect tag a schema pins, as a literal. */
type DialectOf<S extends Struct> =
    ValueOf<S> extends { readonly dialect: infer D extends string } ? D : never

export type JsonDialect<S extends Struct, E = never> = {
    readonly dialect: DialectOf<S>
    readonly mediaType: `application/${DialectOf<S>}+json`
    readonly encodeText: (value: ValueOf<S>) => string
    readonly validate: (value: JsonUnknown) => Result<ValueOf<S>, ValidationError | E>
    readonly decodeText: (text: string) => Result<ValueOf<S>, ValidationError | E | string>
    readonly entry: DialectEntry
}

// and the factory, whose schema parameter is the one `dialectEntry` takes:
//   <S extends Struct, E = never>(
//       schema: Rest<S, Type>,
//       checkReferences?: (value: ValueOf<S>) => Result<ValueOf<S>, E>,
//   ) => JsonDialect<S, E>
```

**The constraint mirrors `dialectEntry`'s, deliberately.** That function is
declared `@template {Struct} S` taking `@param {Rest<S, Type>} type`
(`../module.f.mjs:126-127`), and the factory hands it the same schema — so a
looser `S extends Type` would admit primitives and bare thunks the runtime
rejects, and the call would need a cast or fail outright. The **parameter**
is therefore `Rest<S, Type>`, not a bare struct: `../module.f.mjs:119-124`
explains that a closed struct would make an older reader reject a blob a
newer writer extended, which is the fail-closed misread the additive-
extension rule exists to prevent. Every dialect states `open`, and the type
should require it.

**The schema's value has to be JSON-representable, and the type does not say
so.** `S extends Struct` admits a schema whose members include rtti `bigint`,
but `encodeText` is `stringify(sort)` over the standard JSON serializer,
whose `primitiveSerialize` sends anything that is not a boolean, number, or
string to `nullSerialize` (`../json/module.f.mjs:59-66`) — so a `bigint`
member would encode as `null`, silently, and `decodeText` would then reject
what `encodeText` produced. The three dialects here are all JSON-valued, so
nothing is wrong today; the gap is that a fourth could be added without the
type objecting.

**Refuse it at construction**, the way `dialectEntry` already refuses a
schema whose `dialect` is not a direct string:

```js
assert(typeof dialect === 'string', 'dialectEntry: schema has no direct string `dialect` member')
```

(`../module.f.mjs:134`). That is the same shape of problem — a schema rtti
accepts but this registry cannot use — answered loudly, once, when the entry
is built rather than silently at encode time. The factory walks the schema's
members and asserts each renders a JSON primitive, so a `bigint` member
fails at module load with a message naming it, not at the first `encodeText`
with a `null`.

**The walk must be cycle-safe, and must not hand-roll that.** A member's
schema can be recursive: `revision`'s `lock` is
`() => ['record', lockValue]` with `lockValue = () => ['or', string, lock]`
(`../revision/module.f.mjs:75-86`), so `lock → lockValue → lock` is a cycle,
and a naive descent through `array`/`record`/`or` would not terminate at
module load — the very moment the assert runs. The schema's own JSDoc names
both the hazard and the answer: the data form (`fjs/rtti/data`, which
`toJsonSchema` already routes through) "closes reference cycles by
identity", tracking schemas by identity rather than structure
(`../../rtti/data/module.f.mjs:792`, `:850`).

Reuse that traversal rather than writing a visited set here — a second
cycle-closing walk over rtti schemas is exactly the duplication this issue
exists to remove, and getting identity-vs-structure wrong is how it would
silently diverge. Pin it: the proof must run the factory over
`revisionSchema` itself, whose recursive `lock` is the case that would hang.

Walk the **declared** members only, and do not follow the `open` rest. The
rest contributes nothing to what `encodeText` accepts: `open(c)` is
`rest(c, unknown)` (`../../rtti/module.f.mjs:166`), and `RestTs<C, R>` for a
non-tuple container is `ConstTs<C>` (`../../rtti/ts/types.ts:353-354`), so
the rest is discarded and `StructTs` adds no index signature
(`:376-378`). `ValueOf<S>` *names* exactly the declared members, so walking
them is what settles the schema's own kinds. Following the rest instead
would reject all three dialects for an `unknown` that never reaches the
encoder's parameter type.

What it does **not** settle is the set of values that reach `encodeText`.
`ValueOf<S>` naming only the declared members is a statement about the
type, not about the objects assignable to it: TypeScript object types are
structurally open, so a variable carrying additional members is assignable
all the same. That is a runtime concern, answered at the encode boundary
below, not something a schema walk can reach.

**The walk settles kinds; the values need their own rule.** A schema whose
members are all JSON kinds still admits
values the encoder cannot round-trip: rtti `number` has no finiteness
refinement, `numberSerialize` is `[jsonStringify(input)]`
(`../json/serializer/module.f.mjs:83-84`), and `JSON.stringify` renders
`NaN` and `±Infinity` as `null` — a rule this repo already documents at
`../json/extended/module.f.mjs:50-52`, in the same breath as the fact that
those values "cannot arrive from JSON text but can be supplied
programmatically". So `revisionSchema`'s
`generation: number` (`../revision/module.f.mjs:128`) is a live instance:
`encodeText({ …, generation: NaN })` emits `null` and `decodeText` then
rejects it, exactly the `bigint` failure one layer down. Claiming the
construction assert establishes "JSON-representable" without qualification
would therefore be false.

The answer is one rule in one place, not a documented caveat: after
`rttiParse` succeeds, walk the value it rebuilt and reject any number
`encodeText` cannot reproduce.

```js
/** A number `JSON.stringify` renders without changing its value. */
const jsonExact = x => Number.isFinite(x) && !Object.is(x, -0)
```

Both bad cases are one failure. `NaN` and `±Infinity` serialize as `null`
(`../json/extended/module.f.mjs:50-52`), and `-0` serializes as `0` —
`JSON.stringify(-0)` is `"0"` — while this repo deliberately keeps the two
apart: `../../types/object/structurally_same/module.f.mjs:25` says `0` and
`-0` differ, and `../../rtti/data/module.f.mjs:122-128` orders them apart.
Neither survives a round trip; one is rejected on the way back, the other
silently changes value.

**Why `validate` owns this and not "the value came from JSON text".**
Provenance is not something the type carries. `validate` is a *public*
entry point taking `JsonUnknown`, and TypeScript's `number` includes `NaN`,
so `validate({ dialect: 'x', value: NaN })` is a well-typed call on a
hand-built object — scoping the guarantee to JSON-sourced values would be
an assumption about callers, not a property of the API. And `-0` needs no
such caller at all: `../json/module.f.mjs`'s parser returns negative zero
for the `-0` literal, pinned at `../json/extended/proof.f.mjs:61`
(`Object.is(parseValue('-0'), -0)`), so it arrives from JSON text.

**One generic walk, after the parse — not a schema-specialized check.** It
would be possible to compile the schema's `number` positions at construction
and check only those, with a fixed lookup where the position is a declared
member path and a traversal only where it is a pattern beneath an
`array`/`record`. Don't. That buys a linear walk's worth of nothing for the
dialects that have no numbers, and pays for it with compiled positions, two
checking strategies to keep in agreement, and the schema's reference cycles
to re-handle — optimization ahead of any measured need, which
the repo-root `AGENTS.md:23-26` puts first among the three principles that
outrank everything else. The generic walk is over the *rebuilt value*, a finite JSON
tree, so it has no cycle problem at all — the cycle hazard was in walking
schemas, and this walk never does.

It also cannot be evaded. Running it inside the factory's `validate` means
no dialect's refinement is asked to carry the rule: `checkReferences` is an
arbitrary callback whose contract says nothing about numbers, so an identity
refinement over `array(number)` would return `ok` for an element that is
`NaN`, `encodeText` would emit `null` for it, and `decodeText` would reject
what `encodeText` produced. Presence of a refinement is not verification; a
walk the factory runs itself is.

**The guarantee is a fixpoint over `validate`'s output, not over its
input.** `decodeText(encodeText(validate(x)[1])) = validate(x)` — stated on
the value `validate` *returns*, which is the one thing both sides share. It
cannot be stated over an accepted input, because these schemas are
deliberately `open` and `rttiParse` rebuilds declared members only:
`parse(open({ a: number }))({ a: 1, b: 2 })` is `['ok', { a: 1 }]`, spelled
out in the reader's own JSDoc (`../../rtti/parse/module.f.mjs:525-533`). So
a revision carrying a `future` field is accepted while `encodeText` of the
*input* would carry a member the round trip drops — and `ValueOf<S>` cannot
exclude that input, since TypeScript object types are structurally open.
Dropping extras is the versioning rule working as designed (`../module.f.mjs:119-124`);
the contract just has to be stated where it is true.

On `validate`'s output the fixpoint holds exactly, with no caveat about
provenance and no exception for `-0`. The error is a `ValidationError` with
the offending path — which the walk collects as it descends, and which
`validate`'s declared result type already admits — so no dialect's published
signature changes.

`revision` should still add `Object.is(r.generation, -0)` beside its
existing check (`:232`), but now as a better message rather than as the
guarantee: `../revision/module.f.mjs:204-208` already argues a generation is
an exact count derived as `1 + max(parents')`, which never yields negative
zero, so the dialect has its own reason to name the value. It stops being
load-bearing once the factory enforces the rule.

**`encodeText` needs a walk too — a wider one, and it refuses rather than
reports.** `encodeText` is public and takes a bare `ValueOf<S>`, with
nothing marking the value as having passed `validate`, so a caller may hand
it one that never did. `fjs/cas/evo` does exactly that in production:
`encodeText(canonicalRevision)` (`../../cas/evo/module.f.mjs:521`), on a
revision that module builds itself. Left unchecked, a `NaN` `generation`
there produces well-formed JSON containing `null` — a plausible wrong
answer to an unsupported input, which `DESIGN.md §10` refuses outright.

**The two boundaries check different things, because they are handed
different things.** `validate` receives a value parsed from JSON text: every
leaf is already a JSON kind, so the only way a leaf can be unencodable is
an inexact number, and `jsonExact` is the whole check. `encodeText`
receives an arbitrary JS value that the type system cannot confine — object
types are structurally open, so a *variable* holding
`{ ...revision, future: 1n }` is assignable to `ValueOf<S>` (only a fresh
object literal would be caught, by excess-property checking). `stringify`
walks the runtime object, not the schema, and `primitiveSerialize` sends
anything that is not a boolean, number, or string to `nullSerialize`
(`../json/module.f.mjs:59-65`) — so that `bigint` is emitted as
`"future": null`. Checking only numbers at this boundary would leave
exactly the failure the boundary exists to prevent.

So the encode-side predicate is JSON-representability of every runtime
leaf, of which `jsonExact` is the number case:

```js
const jsonLeaf = x =>
    x === null || typeof x === 'boolean' || typeof x === 'string'
    || (typeof x === 'number' && jsonExact(x))
```

Reject rather than strip. Rebuilding the value through the schema before
serializing would also stop the bad output, but by *silently dropping* the
member the caller passed — and between refusing an input and answering it
with a quietly different one, `DESIGN.md §10` is unambiguous. Stripping
would also make `encodeText` a second validator, doubling what `validate`
already owns.

They differ in how they fail, too:

- `validate` receives **data** — an untrusted blob's parsed value — so a
  bad number is an ordinary `ValidationError` with a path, like every other
  way that data can be wrong.
- `encodeText` receives a **typed value the caller vouched for**. A leaf
  that cannot be encoded is a broken precondition, i.e. a programming
  error, and this repo answers those with a loud `assert` — the same
  instrument `dialectEntry` uses one line above its own cast
  (`../module.f.mjs:134`). Changing the return type to a `Result` would
  break `evo` and every other caller for a case that is a bug at the call
  site, not a runtime condition to handle.

The cost objection does not survive contact: `encodeText` already traverses
the whole value to serialize it, so the check is a second pass of the same
order over the same data, not a new class of work. Folding it into that
existing pass would mean changing `../json`'s serializer, which would reach
every JSON consumer in the repo and is out of scope here. Narrowing the
schema is not available either — rtti cannot express a finite `number`, the
same expressiveness limit that sends the `bigint` half to a runtime assert.

A type constraint — requiring `ValueOf<S>` assignable to `JsonUnknown` — is
strictly better where it can be expressed, since it moves the failure to
compile time, and is worth attempting first. But it is not a substitute for
the assert and must not be the only answer: `dialectEntry`'s own JSDoc
(`../module.f.mjs:113-118`) records that TypeScript could not express the
direct-string-`dialect` half either, which is why the assert exists. Assume
the same may hold here. A JSDoc precondition alone is **not** an option: it
constrains no caller, and this issue's own task requires refusal rather than
documentation.

**If the constraint is dropped, the two JSON-only boundaries need a stated
cast.** Without `ValueOf<S> extends JsonUnknown`, nothing tells the checker
that a `ValueOf<S>` is JSON — `S extends Struct` still admits schemas whose
`Ts` includes `bigint` or `undefined` — so `stringify(sort)`, typed
`(_: JsonUnknown) => string`, is not assignable to the promised
`(value: ValueOf<S>) => string`, and the parsed value cannot be handed to
the JSON-only `jsonExact` walk either. Both are the same boundary, and both
take the cast on the **value**, once each:

```js
const encodeText = value => stringify(sort)(/** @type {JsonUnknown} */ (value))
```

A single cast is enough — no `unknown` intermediate — including when
`ValueOf<S>` is an unreduced conditional type that could yield
`bigint | undefined`; checked with `tsc --strict`. What justifies it is the
construction-time assert, not optimism: the schema has already been refused
if any member is a non-JSON kind, so by the time either boundary runs, the
cast restates a fact established at module load. That is exactly the trade
`dialectEntry` already makes one line above its own assert —
`/** @type {ValidateE} */ (rttiParse(type))` (`../module.f.mjs:135`) — an
erased cast paid for by a check that ran first. Keep the constraint if it
expresses; if it doesn't, this is the shape of the fallback, and it is
sound for the same reason.

**The value is `Ts<S>` — not `Ts<Rest<S, Type>>`.** The two are the
same type here: `RestTs<C, R>` is `C extends Tuple ? TupleRestTs<C, R> :
ConstTs<C>` (`../../rtti/ts/types.ts:353-354`), so for a non-tuple container
the rest is *discarded*, and `Ts` of a bare struct falls through to
`ConstTs` as well (`:484`). Both spellings reduce to `ConstTs<S>`, which is
exactly the `Revision`/`Lock`/`Note` each module already derives.

Prefer the short one. Writing `Ts<Rest<S, Type>>` in a *generic* signature
makes inference expand the wrapper through rtti's recursive `Type` and risks
TS2589 — a hazard this file takes seriously enough to carry an explicit
fast-path against (`../../rtti/ts/types.ts:451-453`). Since the long form
buys nothing for a struct, it is only a way to fail the `tsc` check the
tasks below require.

**The dialect is derived, not a parameter.** A type parameter appearing only
in the return type cannot be inferred from a `jsonDialect(schema, …)` call —
it would fall back to `string` and widen both constants, which is the whole
thing this section exists to prevent. Deriving it from `S` removes the
problem: `S` *is* inferable, from the first argument.

The derivation is sound because each schema already pins the tag —
`revisionSchema = open(/** @type {const} */ ({ dialect, … }))`
(`../revision/module.f.mjs:123`) — and it is the type-level counterpart of
what `dialectEntry` does at runtime, reading `dialect` off the schema and
asserting it is a string (`../module.f.mjs:131-135`). If `Ts<>` turns out to
widen the member rather than preserving the literal, the fallback is an
explicit first argument, `jsonDialect(dialect, schema, …)` — which costs a
redundant-looking parameter but keeps the literal, and is the only other way
to make it inferable.

Constraining `S` at all is required, not decorative: `Ts` is declared
`Ts<T extends Type>` (`../../rtti/ts/types.ts:450`), so an unconstrained
parameter does not typecheck anywhere `ValueOf` reaches it.

The `JsonUnknown` alias is load-bearing too. `../types.ts:8` already binds
the bare name `Unknown` to rtti's — the encoding-neutral one admitting
`bigint` and `undefined` — and its own JSDoc at `:14-15` draws exactly this
contrast for `DialectEntry.match`. But the three `validate` exports take
`fjs/media/json`'s JSON-only `Unknown` (`../revision/module.f.mjs:17`,
`../note/module.f.mjs:28`), so writing the bare name in this file would
silently widen their parameter type and break the identical-declarations
requirement below. Import the JSON one under an explicit alias.

`dialectMediaType` is typed `<D extends string>(dialect: D) =>
\`application/${D}+json\`` so the derivation preserves the literal rather
than erasing it.

Treat that shape as the starting point, not a specification: it is written
from the three modules as they stand, and the implementation typechecks it
against them.

The check that settles all of it is the emitted `.d.mts`, not that `tsc`
passes: `revision.mediaType` must still read
`'application/vnd.fjs.revision+json'` rather than `string`, and
`revision.validate` must still read `Result<Revision, RevisionError>` rather
than a widened union.

Each dialect module then states its schema and (for `revision`/`lock`) its
`checkReferences`, re-exporting the derived kit — the module's JSDoc keeps
describing the format, the mechanics live once.

**Re-export under the existing names.** The kit's `entry` is generic, but
each module publishes its own: `revisionDialect` (`../revision/module.f.mjs:276`),
`lockDialect` (`../lock/module.f.mjs:131`), and `noteDialect`
(`../note/module.f.mjs:138`). These are not proof-only conveniences —
`../../mcp/cas/module.f.mjs:120-122` imports all three and passes them to
`detect` at `:168`, and `../module.f.mjs:17` names them in its own JSDoc — so
spreading the kit and letting `entry` stand would delete three public names
that production code depends on. Each module keeps its own:

```js
export const revisionDialect = kit.entry
```

The same applies to every other name the modules publish today: `dialect`,
`mediaType`, `encodeText`, `validate`, `decodeText`, `isHash` on `revision`,
and — the one this list first missed — **`checkReferences` on both
`revision` and `lock`**. That one is not a detail: `../../cas/evo/module.f.mjs:78`
imports `revision`'s alongside `encodeText`, `decodeText`, `dialect` and
`isHash`, so deleting it breaks production, and `lock`'s is exported at
`../lock/module.f.mjs:94` with its own proof rows
(`../lock/proof.f.mjs:117-123`). The refinement is the **input** the factory
takes, not something it replaces: each module keeps defining and exporting
its own, and passes it in. `note` has none, which is exactly why the
factory's `checkReferences` parameter is optional.

The factory supplies the values; the module still spells out what it
exports, so the public surface is unchanged by construction rather than by
inspection.

For the media type, share the **rule**, not a field on the entry:

```js
/** The media type a `vnd.fjs.*` dialect is served with. */
const dialectMediaType = dialect => `application/${dialect}+json`
```

`detect` keeps deriving from `matched.dialect` (`module.f.mjs:165`) and the
factory builds each module's exported `mediaType` constant with the same
helper, so the two stop being independent spellings of one rule. Do **not**
move the derivation onto `DialectEntry`: `../types.ts:18-28` states that the
type is deliberately not opaque and a caller may write the `{ dialect, match }`
struct by hand, so reading `matched.mediaType` in `detect` would report
`undefined` for every handwritten entry, and making the field required would
break those callers outright. Keeping the rule in a shared function preserves
that contract while still having one owner.

The `isValid…` adapters disappear into the factory; alternatively (or
additionally) `fjs/types/result` grows the `isOk` they both hand-roll.

**`match` and `validate` must be the same acceptance rule.** This is where
the adapters going into the factory earns its keep, and it is not optional.
`dialectEntry` builds `match` as `matchWith(rttiParse(type))(extraValidate)`
(`../module.f.mjs:136`, `:72-75`) — the rtti shape check plus whatever
boolean the registrant passed, and nothing else. If the factory's exact-number
walk lives only in its `validate`, the two predicates diverge: for a
factory-built dialect that supplies no refinement, `detect` would classify a
blob carrying `-0` as `application/vnd.fjs.x+json` (`:165`) while that
dialect's own `decodeText` rejects it — detection labelling a blob its
decoder will not read, which is the plausible-wrong-answer failure
`DESIGN.md §10` refuses.

So the kit builds its `entry` from its **own** `validate`, not from the
schema a second time:

```js
const entry = { dialect, match: u => isOk(validate(/** @type {JsonUnknown} */ (u))) }
```

The cast is the one `dialectEntry` already performs for the same reason
(`../module.f.mjs:135`): `DialectEntry.match` takes rtti's encoding-neutral
`Unknown` so an entry stays usable by a future non-JSON detector
(`../types.ts:14-16`), while `validate` takes the JSON-only one. One rule,
two spellings of the same question — which is this issue's whole point, one
level up from the seven-line kit.

### Tasks

- [ ] Add `jsonDialect` and the shared `dialectMediaType` to
      `module.f.mjs`; have both `detect` and the factory derive through it.
      `DialectEntry` keeps its `{ dialect, match }` shape unchanged.
- [ ] Type the factory as `JsonDialect<S extends Struct, E>` above — the
      dialect derived by `DialectOf<S>`, the value by
      `ValueOf<S> = Ts<S>`, the error union widened by the
      refinement only — and confirm in the emitted `.d.mts` that **every**
      export keeps its current type: the two literals, and
      `encodeText`/`validate`/`decodeText` for each of the three dialects.
      `note`'s `validate` stays `Result<Note, ValidationError>` with no
      `string`, which is the case that catches an over-wide `E`.
- [ ] Refuse a non-JSON schema at construction, with an `assert` beside
      `dialectEntry`'s, reusing `rtti/data`'s identity-based traversal rather
      than a new visited set. Prove both halves **in `../proof.f.mjs`**,
      calling `jsonDialect` directly — it is a new export, and the three
      dialect modules using it do not call the exported name from a proof:
      a `bigint`-membered schema
      throws there rather than encoding as `null`, and `revisionSchema` — whose
      `lock` is recursive — constructs without hanging. Attempt the
      `ValueOf<S>`-assignable-to-`JsonUnknown` constraint too, and keep it
      if it expresses cleanly — but the assert stays either way. If the
      constraint is dropped, take the value-position cast at both JSON-only
      boundaries — `stringify(sort)` and the `jsonExact` walk — as above;
      `tsc` fails without it.
- [ ] Walk `encodeText`'s argument for `jsonLeaf` — every runtime leaf, not
      just the numbers — and `assert` rather than returning a `Result`. It
      takes a bare `ValueOf<S>` no one has to have validated, and
      `../../cas/evo/module.f.mjs:521` calls it directly. Prove both leaf
      kinds throw rather than encoding: a `NaN` `generation`, and an extra
      member the type system cannot exclude —
      `const r = { ...revision, future: 1n }; encodeText(r)`, which today
      emits `"future": null` (`../json/module.f.mjs:59-65`). Do not strip
      the value through the schema instead; refuse it. Confirm `evo`'s
      existing proofs still pass.
- [ ] Run one generic `jsonExact` walk over the value `rttiParse` rebuilds,
      inside the factory's `validate`, collecting the path as it descends.
      One strategy, no compiled positions, and nothing a dialect's
      refinement can waive. Prove four: `validate` rejects `NaN` and `-0` at
      `generation` with a `ValidationError` naming the path; a dialect with
      `array(number)` and an identity refinement still rejects a `NaN`
      element (the case a per-schema check would have missed); and the
      fixpoint `decodeText(encodeText(validate(x)[1])) = validate(x)` for a
      revision — stated on `validate`'s **output**, since `open` schemas
      drop undeclared members (`../../rtti/parse/module.f.mjs:525-533`) and
      the identity does not hold over an accepted input. Compare with
      `assertStructurallySame`, not `Object.is` — `decodeText` builds a
      fresh object, so `Object.is` on the whole value is false for any
      input; the structural comparison is the one that reaches primitives
      with `Object.is` and so still separates `0` from `-0`
      (`../../types/object/structurally_same/module.f.mjs:25`).
- [ ] Add a proof row for the dropped-extras case itself, so the fixpoint's
      scope is pinned rather than assumed: a revision blob with a `future`
      member validates, and the value it returns does not carry it.
- [ ] Add `Object.is(r.generation, -0)` to `revision`'s own check for the
      better message, and prove `decodeText('{"generation":-0,…}')` is an
      error. Independent of the factory — worth landing on its own.
- [ ] Build the kit's `entry` from the kit's own `validate`, so `match` and
      `validate` are one acceptance rule rather than two. Prove the case
      that would otherwise diverge: for a factory-built dialect with no
      refinement, a blob whose only fault is a `-0` is rejected by
      `decodeText` **and** not classified by `detect` — today's `match`
      (`../module.f.mjs:136`) would accept it, since it runs the shape check
      and the refinement only.
- [ ] Rewrite `revision`, `lock`, and `note` over it; delete the per-module
      copies and the two `isValid…` adapters. Keep every published name —
      `revisionDialect`/`lockDialect`/`noteDialect` aliasing the kit's
      `entry`, plus `dialect`, `mediaType`, `encodeText`, `validate`,
      `decodeText`, `revision`'s `isHash`, and `checkReferences` on both
      `revision` and `lock` — the refinement stays each module's own
      definition and export, passed *into* the factory
      (`../../cas/evo/module.f.mjs:78` imports `revision`'s).
- [ ] Diff the three modules' `.d.mts` against the pre-change ones: the set
      of exported names and their types should be identical. That is the
      check, not reading the diff — `../../mcp/cas/module.f.mjs:120-122` is
      production code importing the three entry names.
- [ ] `tsc`, `fjs t`; the media and mcp proofs pass unchanged.

### Related

- [change-content-format.md](./change-content-format.md) — the planned
  fourth dialect; land the factory first so `change` states only its schema.
- [json/todo/stringify-sorted-canonical.md](../json/todo/stringify-sorted-canonical.md)
  — the `stringify(sort)` idiom; its site list predates these three
  `encodeText` copies, which the factory would collapse to one.
