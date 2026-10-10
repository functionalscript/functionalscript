## Consumers each decide whether a specifier is a path

**Priority:** P3
**Status:** open

### Problem

Whether an import specifier names a file path — `./`, `../` or `/` — or is
bare is decided by [`fjs/path/import`](../module.f.mjs)'s consumers, each
with a prefix test of its own, and the module that owns import-specifier
admission does not offer the answer:

- `_importSources` in
  [`fjs/compiler/source`](../../../compiler/source/module.f.mjs) refuses a
  specifier that starts with none of the three, then calls this module's
  `decode` on the survivors.
- `specifier` in
  [`fjs/emergent_testing/browser`](../../../emergent_testing/browser/module.mjs)
  resolves one that starts with any of the three against the page's URL and
  passes the rest through — the same test, in a host `.mjs`.
- `local` in
  [`fjs/website/browser-source`](../../../website/browser-source/module.f.mjs)
  tests `./` and `../` only. Nothing says why a rooted specifier is not
  local there, so a reader cannot tell a choice from an omission.

The duplicated rule has drifted: the website's test is narrower. The
compiler's message, `expected ./, ../, or /`, documents the rule in prose at
one of the sites rather than in the module that owns it.

### Proposal

`fjs/path/import` exports the classification — one function answering
`'relative'`, `'rooted'` or `'bare'`, or a predicate over the first two —
and the three callers ask it. The website's narrower rule is then either a
documented choice made on top of the classification, or gone.

### Tasks

- [ ] Export the classifier with a proof at 100%.
- [ ] Move the three sites onto it; decide and document `browser-source`'s
      rooted case.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [import-root-split](../../todo/import-root-split.md) — this module's root
  rule against `fjs/path`'s; the classification above is upstream of both.
- [compile-modules-to-edag](../../../compiler/todo/compile-modules-to-edag.md)
  — the bare-specifier policy the compiler will need, which wants one place
  to ask what a bare specifier is.
