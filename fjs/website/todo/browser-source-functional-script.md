## Move browser source analysis to FunctionalScript

**Priority:** P2
**Status:** open

### Problem

[`browser-source.mjs`](../browser-source.mjs) contains pure source-analysis logic:
it tokenizes authored modules, detects a named `proof` export, extracts static
module specifiers, and classifies local imports. This is business logic with no
host or effect boundary, so keeping it in plain `.mjs` violates the repository
rule that business logic under `fjs/` belongs in FunctionalScript.

The existing file is migration debt, not an exception to that rule.

### Proposal

Move the pure scanner and classification API to authored `.f.mjs` with normal
FunctionalScript proofs. Keep plain `.mjs` only if a genuinely host-specific
adapter remains; do not preserve an `.mjs` wrapper merely for the old filename.
Update website preparation to consume the FunctionalScript module directly.

### Tasks

- [ ] Move `exportsProof`, `specifiers`, `local`, and their supporting scanner
      logic from `browser-source.mjs` to `.f.mjs`.
- [ ] Move the corresponding pure proofs to `.f.mjs` and preserve coverage.
- [ ] Update `browser-prepare.mjs` and other importers to use the FunctionalScript
      module.
- [ ] Delete the obsolete plain `.mjs` implementation once no host-specific
      boundary remains.

### Related

- [`browser-source.mjs`](../browser-source.mjs)
- [`emergent_testing/todo/share-browser-console-runner.md`](../../emergent_testing/todo/share-browser-console-runner.md) — existing ordered migration plan for the separate `emergent_testing/browser.mjs` violation.
