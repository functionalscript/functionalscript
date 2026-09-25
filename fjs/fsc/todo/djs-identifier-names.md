## Drop the DJS name from `fjs/fsc` identifiers

**Priority:** P4
**Status:** open

### Problem

The specification and the `fjs/fsc` documentation no longer use the name
DJS: a module is a module, and a sentence that needs the function-free part
of the language says "a module without functions" in words
([`spec/README.md`](../../../spec/README.md)). The code still spells it in
identifiers, so a reader meets a name the documents have dropped and nothing
defines:

- exported types in [`../tokenizer/types.ts`](../tokenizer/types.ts):
  `DjsToken` and `DjsTokenWithMetadata`, imported across `fjs/fsc/parser`;
- exports: `_djsTokenKinds` in
  [`../tokenizer/module.f.mjs`](../tokenizer/module.f.mjs) and `djsModule`,
  the start rule of [`../parser/grammar/module.f.mjs`](../parser/grammar/module.f.mjs);
- private names: the tokenizer's `mapDjsToken`, the AST evaluator's `toDjs`
  and its local `djs` values in [`../ast/module.f.mjs`](../ast/module.f.mjs),
  the transpiler's `mapDjs`;
- proof names: `djsTokenize`, `stringifyDjsModule`, `mapDjsUnresolvedImport`,
  `jsonInputRejectsDjsExtensions`, and the `djs` locals in
  [`../ast/proof.f.mjs`](../ast/proof.f.mjs).

Two mentions are history and stay: `fjs/fsc`'s `isDataJs` JSDoc and
its proof both say `.d.js` "was DJS's spelling and went with the name".

### Proposal

Rename each identifier to what it names — `ModuleToken`, `moduleTokenKinds`,
`module`, `toValue` — or pick shorter names where the module already says
"module". The exported types and `_djsTokenKinds` are API, so the pull
request that renames them declares the break and updates every importer in
the same change.

### Tasks

- [ ] Rename the exported types and values, updating every importer.
- [ ] Rename the private and proof names.

### Related

- [`spec/README.md`](../../../spec/README.md) — the specification that
  dropped the name.
