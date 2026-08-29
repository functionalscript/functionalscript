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

```ts
export type JsonDialect<D extends string> = {
    readonly dialect: D
    readonly mediaType: `application/${D}+json`
    // …encodeText, validate, decodeText, entry
}
```

with `dialectMediaType` typed `<D extends string>(dialect: D) =>
\`application/${D}+json\`` so the derivation preserves the literal rather
than erasing it. Check the emitted `.d.mts`, not just that `tsc` passes:
`revision.mediaType` must still read `'application/vnd.fjs.revision+json'`,
not `string`.

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
- [ ] Type the factory over the dialect literal (`JsonDialect<D>` above) and
      confirm in the emitted `.d.mts` that each module's `dialect` and
      `mediaType` keep their literal types rather than widening to `string`.
- [ ] Rewrite `revision`, `lock`, and `note` over it; delete the per-module
      copies and the two `isValid…` adapters.
- [ ] `npx tsc`, `fjs t`; the media and mcp proofs pass unchanged.

### Related

- [change-content-format.md](./change-content-format.md) — the planned
  fourth dialect; land the factory first so `change` states only its schema.
- [json/todo/stringify-sorted-canonical.md](../json/todo/stringify-sorted-canonical.md)
  — the `stringify(sort)` idiom; its site list predates these three
  `encodeText` copies, which the factory would collapse to one.
