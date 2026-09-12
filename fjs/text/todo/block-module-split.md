## block-module-split. The `Block` renderer shares a module with the UTF-8 boundary

**Priority:** P4
**Status:** open

### Problem

`fjs/text/module.f.mjs` states its own split in its first line —
"Indented text `Block` rendering and UTF-8 helpers" — and the two halves
share nothing: not an import, not a type. `types.ts` splits the same way
(`Block`/`Item` vs `Utf8`).

Every production importer of the module (~25 across `crypto`, `effects`,
`web`, `website`, `media/html`, `cas/evo`, `mcp`, `protocol/mcp/stdio`,
`sul/id`, `djs`, `git/repo`, …) imports only `utf8`/`tryUtf8`/
`utf8ToString`. The sole importer of `flat` is `fjs/text/proof.f.mjs`,
and the sole reference to `Block` outside `types.ts` is the same proof —
an exported capability with no consumer, the shape
[../sgr/todo/inplace-writer-split.md](../sgr/todo/inplace-writer-split.md)
already flags one directory over.

It also blocks a cleaner end-state for
[../utf8/todo/vec-to-code-point-pipeline.md](../utf8/todo/vec-to-code-point-pipeline.md):
that todo asks whether `utf8ToString` should move next to `fromVec`,
which would leave this module as a block renderer it is not named after.

### Proposal

Either move `flat`/`Block`/`Item` to their own module (`fjs/text/block/`)
with their proof case, leaving `fjs/text` as the UTF-8/string boundary
its importers actually consume — or, since no production consumer exists
at all, delete them as speculative code, per the design rule that an
extraction waits for its second real consumer. Decide before
`vec-to-code-point-pipeline` lands; its "does `utf8ToString` move?"
question has an obvious answer once `flat` is gone.

### Tasks

- [ ] Decide move-vs-delete; do it; proof follows.
- [ ] `tsc`, `fjs test`.
