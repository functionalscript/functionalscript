## The root page is a second copy of `page`

**Priority:** P3
**Status:** open

### Problem

`rootPage` in [`fjs/website/module.f.mjs`](../module.f.mjs) and `page` in
[`fjs/website/page/module.f.mjs`](../page/module.f.mjs) build the same page
from the same builders — `shell`, `directoryLayout`, `testsMain`,
`demoSection`, `testSection` — and differ in three leaves: the title
(`siteName` against `pageTitle(dir.path)`), the heading (a plain `h1` against
`breadcrumb`), and the suite intro paragraph the root adds to its test section.
The API links `page` adds are `null` at the root anyway. `writePages` then
branches on `dir.path === '.'` to choose between them.

The `@module` doc of `page` explains the split with a description that is no
longer true: it says the root page "takes `sections` and keeps its own frame".
`rootPage` no longer takes `sections`; it imports the whole frame from `page`.
The website README's "Every directory gets a page" says the opposite of a
special case: the root page "carries the project's name and the same
catalogue — rather than a special case beside the rule."

On the way: `cliPage` is the one page builder that bypasses `pageTitle`, so its
tab reads differently from every other page's `<page> · FunctionalScript`.

### Proposal

`page` owns the root case. The title is `siteName` where `dir.path` is `.`
and `pageTitle(dir.path)` elsewhere; the heading is a plain `h1` where there
are no ancestors, which is what the README already says a page without
ancestors gets (so `breadcrumb` can answer it); the suite intro is a constant
in `page` that `testSection` takes for the root. `writePages` calls `page`
unconditionally.

### Tasks

- [ ] Fold the three root leaves into `page`; delete `rootPage` and the
      `.` branch of `writePages`.
- [ ] Stop exporting the frame builders the generator no longer imports
      (`shell` stays: the changelog, PR, CLI and cargo-doc pages use it).
- [ ] Rewrite the stale paragraph of `page`'s `@module` doc.
- [ ] Route `cliPage`'s title through `pageTitle`.

### Related

- [generate-website](./generate-website.md) — the umbrella; lists the
  per-directory page as done and says nothing about the root frame.
