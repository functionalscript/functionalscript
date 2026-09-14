## block-module-split. The `Block` renderer shares a module with the UTF-8 boundary

**Priority:** P4
**Status:** open

### Problem

`fjs/text/module.f.mjs` states its own split in its first line —
"Indented text `Block` rendering and UTF-8 helpers" — and the two halves
share nothing: not an import, not a type. `types.ts` splits the same way
(`Block`/`Item` vs `Utf8`).

Every production importer of the module — about a dozen: `cas/evo`,
`effects/common`, `effects/node`, `effects/node/virtual`, `mcp/cas`,
`media/html`, `protocol/mcp/stdio`, `sul/id`, `text/sgr`,
`types/uint8array`, `web`, and `website` — imports only `utf8`/`tryUtf8`/
`utf8ToString`. (`crypto/hmac` is not one: its only mention outside its proof is a
doc-comment `@example` importing a `msbUtf8` the module does not export —
a stale example, not an importer.) The sole importer of `flat` is `fjs/text/proof.f.mjs`,
and the sole reference to `Block` outside `types.ts` is the same proof —
an exported capability with no consumer, the shape
[../sgr/todo/inplace-writer-split.md](../sgr/todo/inplace-writer-split.md)
already flags one directory over.

It also blocks a cleaner end-state for
[../utf8/todo/vec-to-code-point-pipeline.md](../utf8/todo/vec-to-code-point-pipeline.md):
that todo asks whether `utf8ToString` should move next to `fromVec`,
which would leave this module as a block renderer it is not named after.

### Proposal

**Delete** `flat`, `Block`, and `Item`, with their proof case. No
production consumer exists, so the design rule applies — an extraction
waits for its second real consumer, and this one never had a first.
Moving them to `fjs/text/block/` would keep a public module nothing
imports, which is the same speculative surface under a better name. They
are exported from `module.f.mjs`/`types.ts`, so this is a declared
breaking change with a `Changelog:` entry; if a block renderer is wanted
later, it is written next to its consumer, and `git log` keeps this one.
`fjs/text` is then the UTF-8/string boundary its importers actually
consume, and `vec-to-code-point-pipeline`'s "does `utf8ToString` move?"
question has an obvious answer.

### Tasks

- [ ] Delete `flat`/`Block`/`Item` and their proof case; fix the module
      doc's first line; declare the break.
- [ ] `tsc`, `fjs test`.
