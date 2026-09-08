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

### Decisions

These settle the open questions the first revision of this issue carried.

- **Serving model stays as it is.** `wrangler.jsonc` publishes the repository
  folder; the generator writes its output next to the source, and `.gitignore`
  already ignores `index.html`. There is no separate output tree. A page may
  therefore load any repository file by its path at runtime — source, proofs,
  demos — which is what [source-and-doc-view](source-and-doc-view.md) and
  [demo-convention](demo-convention.md) build on. The isolated HTML-and-JS root
  that [browser-testing](../../emergent_testing/todo/browser-testing.md)
  describes is that issue's concern for automated runners; module pages do not
  depend on it, and moving the site to such a root would break every fetch
  they make, so it is not a change to make in passing.
- **Page unit is a directory containing `module.f.mjs`.** Every such directory
  gets an `index.html`. Other authored modules in the same directory
  (`example.f.mjs`, `browser.mjs`) are listed on that page as files. A
  directory without `module.f.mjs` (`fjs/crypto/`) gets no page of its own;
  whether it gets a bare listing of subdirectories so the tree is walkable
  from the root is the one question still open below.
- **A page runs the proofs of its subtree.** The page for `fjs/text/` runs
  every browser-linkable proof under `fjs/text/`, not only `fjs/text/proof.f.mjs`.
  This is the existing runner with a shorter list, and the list is a slice of
  the manifest the generator already computes — sources are in path order, so a
  subtree is a contiguous run of prefix matches.
- **A proof that cannot link in a browser is named, not hidden.** The
  manifest generator already knows each proof's blockers (`node:fs`, a bare
  specifier). The page lists such a proof with its blocker, so an empty list
  means "no proofs here" and nothing else.
- **A run starts on `Run`, never on load**, as
  [browser-test-controls](../../emergent_testing/todo/browser-test-controls.md)
  requires. A small page is not an exception.

### Proposal

Generation is a second consumer of the walk `fjs/website/module.f.mjs` already
performs: the traversal that finds proof sources visits every directory this
needs. No second traversal, no npm script beside the program, and any new
filesystem capability is a Node effect with both interpretations proven, as the
website `NodeProgram` already requires.

Each page holds, in order:

1. **Breadcrumb** to the root and to each ancestor that has a page.
2. **Files** — `module.f.mjs`, `types.ts`, `proof.f.mjs`, `README.md`, and any
   other authored module in the directory. Each is a link to its path; the
   rendered source view is [source-and-doc-view](source-and-doc-view.md)'s job.
3. **Subdirectories**, each a link to its own `index.html`.
4. **Proofs** — the subtree's proof sources, named exactly as `fjs t` and the
   browser suite name them, with `Run` and the report UI the root page already
   has. Non-linkable proofs listed with their blocker.
5. **`todo/`** — the open issues filed against this directory, linked by path.
6. Slots the later issues fill: the doc view, the source view, and the demo.

### Tasks

- [ ] Collect, from the existing walk, the set of directories holding
      `module.f.mjs` and, for each, its files, subdirectories and `todo/` entries.
- [ ] Emit one `index.html` per such directory with breadcrumb, files,
      subdirectories and `todo/` list.
- [ ] Emit a per-page entry module that starts the browser runner with the
      subtree's slice of the manifest.
- [ ] List non-linkable proofs with their blockers.
- [ ] Decide whether module-less directories get a bare subdirectory listing.
- [ ] Prove the generator against `effects/node/virtual` with a fixture tree
      that has a nested module, a non-linkable proof and a `todo/` entry.

### Related

- [Generate website](generate-website.md) — the umbrella list this is one line of.
- [Source and doc view](source-and-doc-view.md) — fills slot 6 for source and docs.
- [Demo convention](demo-convention.md) — fills slot 6 for demos.
- [`fjs/website/style`](../style/module.f.mjs) — the stylesheet these pages
  link as `/_main.css`.
- [The two runners, and what sharing them cost](../../emergent_testing/README.md#the-two-runners-and-what-sharing-them-cost)
  — the shared test name, and why the browser suite is generated.
- [Browser testing](../../emergent_testing/todo/browser-testing.md) — the
  isolated application root, deliberately not adopted here.
- [Explicit browser test controls](../../emergent_testing/todo/browser-test-controls.md)
  — a page does not auto-start a run.
