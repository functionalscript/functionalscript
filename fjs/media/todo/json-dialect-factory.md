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
const jsonDialect = (schema, checkReferences) => ({
    dialect,        // read off the schema, as dialectEntry already does
    mediaType,      // `application/${dialect}+json`, stated once
    encodeText,     // stringify(sort)
    validate,       // rttiParse(schema), then okThen(checkReferences) if given
    decodeText,     // okThen(validate)(parseJson(text))
    entry,          // the DialectEntry for `detect`
})
```

Each dialect module then states its schema and (for `revision`/`lock`) its
`checkReferences`, re-exporting the derived kit — the module's JSDoc keeps
describing the format, the mechanics live once. Have `dialectEntry` (or the
factory's `entry`) carry `mediaType` so `detect` reads it instead of
re-deriving it at `module.f.mjs:165`. The `isValid…` adapters disappear into
the factory; alternatively (or additionally) `fjs/types/result` grows the
`isOk` they both hand-roll.

### Tasks

- [ ] Add `jsonDialect` to `module.f.mjs`; carry `mediaType` on the entry
      and read it in `detect`.
- [ ] Rewrite `revision`, `lock`, and `note` over it; delete the per-module
      copies and the two `isValid…` adapters.
- [ ] `npx tsc`, `fjs t`; the media and mcp proofs pass unchanged.

### Related

- [change-content-format.md](./change-content-format.md) — the planned
  fourth dialect; land the factory first so `change` states only its schema.
- [json/todo/stringify-sorted-canonical.md](../json/todo/stringify-sorted-canonical.md)
  — the `stringify(sort)` idiom; its site list predates these three
  `encodeText` copies, which the factory would collapse to one.
