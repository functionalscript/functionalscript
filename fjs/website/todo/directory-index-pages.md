## An `index.html` for every module directory

**Priority:** P3
**Status:** open

### Problem

The generated website is one page. The repository it describes is a tree of
directories, most of which hold a `module.f.mjs`, its `types.ts`, a
`proof.f.mjs`, a `todo/` folder, and some subdirectories — and none of that is
reachable from the site. A reader who wants to know what `fjs/types/list` *is*
reads the source on GitHub; a reader who wants to know whether its proofs pass
runs the whole suite. Neither is a fact the website carries, and both are facts
it already has everything it needs to produce.

Browsing is the missing half. `fjs t` answers "did everything pass" and the
browser suite answers "does everything pass in a browser", but no view answers
"what is in this directory, and what does it prove?" — which is the question a
newcomer, and a maintainer looking at an unfamiliar corner, both start from.

### Preliminary design

For every directory containing a `module.f.mjs` (and, after
[stage 2](../../fsc/README.md#stage-2-mark-compiler-compatible-functionalscript),
an authored `module.f.js`), generate an `index.html` next to it in the output tree.
Each page is a catalog of that directory:

- **Files** — the modules, their `types.ts`, proofs and `README.md`, each linked
  to a rendered source view where one exists. `README.md` conversion is already
  on [generate-website](generate-website.md); this is a consumer of it.
- **Subdirectories** — linked to their own `index.html`, so the tree is
  walkable in both directions. Include a breadcrumb back to the root.
- **Local proofs** — the tests this directory's modules contribute, named the
  way both runners name them (`fmtImport`, `emergent_testing/module.f.mjs`), and
  runnable *here*: the browser runner already takes a list of proof sources, so
  a directory page is that same application with the manifest narrowed to this
  directory. That is the interesting part of this issue — a per-directory page
  is not a new runner, it is the existing one with a smaller list.
- **`todo/`** — the open issues filed against this directory, which are already
  markdown next to the code and are the best available description of what is
  unfinished in it.

Generation belongs in `fjs/website/module.f.mjs` as part of the same
`NodeProgram` that owns the rest of the build — the walk that discovers proof
sources today already visits every directory this needs, so this is a second
consumer of one traversal rather than a second traversal. The
preparation-program boundary this must respect is the one `fjs/website`'s own
`NodeProgram` already keeps: no npm script running an
impure helper as a second entry point, and any new filesystem capability
expressed as a Node effect with both interpretations proven.

### Open questions

- **Does a page run its proofs on load, or on a `Run` click?** Per
  [browser-test-controls](../../emergent_testing/todo/browser-test-controls.md)
  a suite starts on an explicit action, and a directory page should not be an
  exception just because it is small.
- **What does a directory with no `proof` export show?** An empty list is a
  worse answer than saying that the modules here are proven from elsewhere, and
  naming where.
- **How much of the source is rendered?** Linking to GitHub is free and
  immediate; rendering source with highlighting is
  [generate-website](generate-website.md)'s item and a larger change. A first
  iteration can link out and still be useful.
- **Where does the output tree live**, relative to the isolated browser-test
  application root that
  [browser-testing](../../emergent_testing/todo/browser-testing.md) describes?
  A directory page linking to modules is a page that serves source, which that
  issue's application root deliberately does not do. These may be two output
  trees rather than one.

### Constraints

- The catalog is generated, never hand-maintained: a directory that gains a
  module gains it on the page with no edit.
- A page must name a proof exactly as `fjs t` and the browser suite name it.
  Three spellings of one test is the problem this repository has been removing.
- Do not build a second test runner. A directory page is the browser
  application with a narrower manifest.
- No repository-wide index that has to be regenerated whenever any directory
  changes; each page describes its own directory and links to its neighbours.

### Tasks

- [ ] Generate an `index.html` per module directory, from the traversal the
      website program already performs.
- [ ] List files, subdirectories, `todo/` issues, and a breadcrumb.
- [ ] Run the directory's own proofs on the page, through the existing browser
      runner with a narrowed manifest.
- [ ] Decide the source-view question, and link out until it is answered.

### Related

- [Generate website](generate-website.md) — README conversion, source
  highlighting and `main.css`, all of which this page consumes.
- [The two runners, and what sharing them cost](../../emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost)
  — the shared test name, and why the browser suite is generated rather than
  prepared by a script of its own.
- [Browser testing](../../emergent_testing/todo/browser-testing.md) — the
  application root and what it may serve.
- [Explicit browser test controls](../../emergent_testing/todo/browser-test-controls.md)
  — a page does not auto-start a run.
