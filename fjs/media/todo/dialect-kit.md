## Each dialect module re-exports the kit field by field, and a match has two definitions

**Priority:** P4
**Status:** open

### Problem

[`note`](../note/module.f.mjs), [`lock`](../lock/module.f.mjs) and
[`revision`](../revision/module.f.mjs) each end with the same shape: `const
kit = jsonDialect(schema, …)`, then `mediaType`, `encodeText`, `validate`,
`decodeText` and `<name>Dialect` exported one by one as `kit.<field>`, each
with a doc comment that restates the kit's.
[`fjs/media/json`](../json/module.f.mjs) already destructures its `codec(…)`
in one line.

Separately, [`module.f.mjs`](../module.f.mjs) exports two ways to build a
`DialectEntry` with two meanings of a match: `dialectEntry(type,
extraValidate)` matches when `rttiParse` accepts and `extraValidate` agrees;
`jsonDialect(…).entry` matches when `validate` accepts, which adds the
exact-number walk and `checkReferences`. `dialectEntry` has no caller outside
the module's own proof.

### Proposal

`export const { mediaType, encodeText, validate, decodeText, entry:
noteDialect } = jsonDialect(noteSchema)` in each dialect module; and one
definition of a match — `dialectEntry` goes, or `jsonDialect` builds its
`entry` through it.

### Tasks

- [ ] The three dialect modules destructure the kit.
- [ ] One `DialectEntry` constructor.

### Related

- [datajs-dialect-name](./datajs-dialect-name.md) — the dialect registry's
  naming.
