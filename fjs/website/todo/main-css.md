## One `main.css` for the website

**Priority:** P3
**Status:** open

### Problem

The root page carries its stylesheet inline in `fjs/website/module.f.mjs`.
Every module page would carry the same block, and every rule the source view,
the doc view and the demo section add would be added to a string inside a
generator. One page changes its colours; the rest do not.

### Proposal

The generator writes `main.css` once, at the root, from a stylesheet held as
data in `fjs/website/style/module.f.mjs`, and every page links it with a
root-relative `<link rel="stylesheet" href="/main.css">`. The root page's
inline `<style>` moves there unchanged in the same PR; light and dark schemes
and the `data-state` / `data-status` colours it defines are the first
contents. Later issues add their classes — token kinds for the source view,
doc entries, the demo section — to that one file.

### Tasks

- [ ] Move the root page's inline styles into `fjs/website/style/module.f.mjs`.
- [ ] Write `main.css` from the website `NodeProgram`; prove the write against
      the virtual filesystem.
- [ ] Link it from the root page and from every generated module page.

### Related

- [Generate website](generate-website.md) — "One `main.css`" is this issue.
- [An `index.html` for every module directory](directory-index-pages.md) —
  the pages that link it.
