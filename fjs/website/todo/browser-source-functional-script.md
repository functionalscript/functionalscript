## Move browser source analysis to FunctionalScript

**Priority:** P2
**Status:** done — the scanner and its proofs are FunctionalScript, and no
plain `.mjs` was left behind

### Problem

[`browser-source.f.mjs`](../browser-source.f.mjs) contains pure source-analysis
logic: it tokenizes authored modules, detects a named `proof` export, extracts static
module specifiers, and classifies local imports. This is business logic with no
host or effect boundary, so keeping it in plain `.mjs` violated the repository
rule that business logic under `fjs/` belongs in FunctionalScript.

The file was migration debt, not an exception to that rule.

### Proposal

Move the pure scanner and classification API to authored `.f.mjs` with normal
FunctionalScript proofs. Keep plain `.mjs` only if a genuinely host-specific
adapter remains; do not preserve an `.mjs` wrapper merely for the old filename.
Update website preparation to consume the FunctionalScript module directly.

### Tasks

- [x] Move `exportsProof`, `specifiers`, `local`, and their supporting scanner
      logic from `browser-source.mjs` to `.f.mjs`. **The code moved unchanged**,
      which is the finding: the scanner reads a string and answers a value, and
      the only thing that had ever made it plain `.mjs` was the file name. Local
      `let` and `while` over primitives are FunctionalScript — `types/list` and
      `types/bigint` are written that way — so no rewrite was owed.
- [x] Move the corresponding pure proofs to `.f.mjs` and preserve coverage. They
      moved unchanged too, and the repository gained coverage rather than
      preserving it: an authored `.f.mjs` proof runs in the **browser** suite as
      well, which a `.proof.mjs` does not. The manifest went from 146 modules to
      147, and the scanner is now proven by the runner it feeds.
- [x] Update `browser-prepare.mjs` and other importers to use the FunctionalScript
      module. One importer, one line.
- [x] Delete the obsolete plain `.mjs` implementation once no host-specific
      boundary remains. There was none: both files were renames, so no
      implementation was left behind to drift.

### Related

- [`browser-source.f.mjs`](../browser-source.f.mjs)
- [`emergent_testing/todo/share-browser-console-runner.md`](../../emergent_testing/todo/share-browser-console-runner.md) — existing ordered migration plan for the separate `emergent_testing/browser/module.mjs` violation.
