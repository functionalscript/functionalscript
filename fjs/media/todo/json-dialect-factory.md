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
type, with `E = never` for a dialect that has no refinement:

```ts
export type JsonDialect<S, D extends string, E> = {
    readonly dialect: D
    readonly mediaType: `application/${D}+json`
    readonly encodeText: (value: Ts<S>) => string
    readonly validate: (value: Unknown) => Result<Ts<S>, ValidationError | E>
    readonly decodeText: (text: string) => Result<Ts<S>, ValidationError | E | string>
    readonly entry: DialectEntry
}
```

and `dialectMediaType` is typed `<D extends string>(dialect: D) =>
\`application/${D}+json\`` so the derivation preserves the literal rather
than erasing it.

Treat that shape as the starting point, not a specification: it is written
from the three modules as they stand, and the implementation typechecks it
against them. Where `D` comes from is the one open question — reading it off
the schema keeps the call sites free of a redundant argument, but if `Ts<>`
does not surface the `dialect` member as a literal, passing it explicitly is
the fallback and costs nothing.

The check that settles all of it is the emitted `.d.mts`, not that `tsc`
passes: `revision.mediaType` must still read
`'application/vnd.fjs.revision+json'` rather than `string`, and
`revision.validate` must still read `Result<Revision, RevisionError>` rather
than a widened union.

Each dialect module then states its schema and (for `revision`/`lock`) its
`checkReferences`, re-exporting the derived kit — the module's JSDoc keeps
describing the format, the mechanics live once.

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

### Tasks

- [ ] Add `jsonDialect` and the shared `dialectMediaType` to
      `module.f.mjs`; have both `detect` and the factory derive through it.
      `DialectEntry` keeps its `{ dialect, match }` shape unchanged.
- [ ] Type the factory as `JsonDialect<S, D, E>` above — value via `Ts<S>`,
      error union widened by the refinement only — and confirm in the emitted
      `.d.mts` that **every** export keeps its current type: the two literals,
      and `encodeText`/`validate`/`decodeText` for each of the three
      dialects. `note`'s `validate` stays `Result<Note, ValidationError>`
      with no `string`, which is the case that catches an over-wide `E`.
- [ ] Rewrite `revision`, `lock`, and `note` over it; delete the per-module
      copies and the two `isValid…` adapters.
- [ ] `npx tsc`, `fjs t`; the media and mcp proofs pass unchanged.

### Related

- [change-content-format.md](./change-content-format.md) — the planned
  fourth dialect; land the factory first so `change` states only its schema.
- [json/todo/stringify-sorted-canonical.md](../json/todo/stringify-sorted-canonical.md)
  — the `stringify(sort)` idiom; its site list predates these three
  `encodeText` copies, which the factory would collapse to one.
