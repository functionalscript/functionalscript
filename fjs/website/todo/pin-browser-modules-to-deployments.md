## Pin browser modules to one deployment

**Priority:** P3
**Status:** open

### Problem

An open website page can combine modules from different deployments. Demos
load implementations when the page opens; the browser runner loads proofs
later through `startBrowserTestSources`. Both use mutable source URLs. A
deployment between those loads can give new proofs dependencies already held
in the document's ES module registry from the previous deployment. A
deployment during module loading can also change files partway through the
graph.

The reported failures include conditional-admission diagnostics, switch
normalization shape and empty Rust alternates. Pairing the corresponding
proofs from `56c18e2351318ec4dbc40acfddf1819da19012a7` with the parser, sugar
and Rust serializer implementations from
`b1eb58d87877d36c438eb6f5c27c255d61881cba` reproduces all seven reported
failures exactly. Matching proofs and implementations from the newer commit
pass under Node 26.10.0. This establishes the mixed-source failure signature;
the production responses were not inspected to identify the serving or
browser cache responsible.

`Cache-Control: no-cache` on HTML or JavaScript cannot replace modules already
loaded in a document. Cloudflare Workers Static Assets already defaults to
`Cache-Control: public, max-age=0, must-revalidate` with an `ETag`. Repeated
Run clicks reuse the module registry; cache headers alone do not establish a
consistent deployment.

### Proposal

Choose one immutable revision when generating or bootstrapping a page. Pin
its runtime, demo and proof entry URLs, and their complete dependency graph,
to that revision. Relative imports must retain the revision automatically.
Keep earlier revisions servable after subsequent deployments. A missing
revision must fail clearly instead of falling back to current files.

The hosting mechanism remains to be decided:

- Cloudflare version-specific URLs expose an uploaded Worker version with
  its static assets. Establish their availability policy and the CORS
  headers needed for module imports from the production origin. Production
  URLs and moving branch aliases still select mutable deployments.
- A same-origin Worker route can fetch committed sources from the fixed
  GitHub repository at a full commit SHA, preserve the import path layout,
  and serve JavaScript with `Content-Type: text/javascript`. GitHub raw
  responses use `text/plain` with `nosniff`, so direct browser module imports
  are refused. Branch URLs such as `refs/heads/main` remain mutable.
- Retained commit-prefixed asset trees can provide the same contract if old
  trees remain accessible across uploads. Publishing only the newest tree
  does not provide that retention.

Revalidate mutable HTML and cache successful immutable module responses.
Adding a revision query to only an entry module leaves its relative
dependencies unversioned. Identify root-relative data requests and generated
WASM assets separately: they do not inherit a module's relative import base,
and generated files absent from Git need another source if GitHub is chosen.

### Tasks

- [ ] Choose and document immutable module hosting, retention and unavailable
      revision behavior, including production and preview deployments.
- [ ] Pin all generated runtime, demo and proof entry URLs and their
      dependencies to the page's selected revision. Account for cross-origin
      MIME/CORS requirements and identify data/WASM requests outside this graph.
- [ ] Verify a deployment transition in a real browser: open deployment A
      and load a demo, deploy B, then run proofs in the existing tab. The
      existing page must use A throughout; a newly loaded page must use B.
      Also cover a deployment during module loading and an unavailable revision.
- [ ] Document cache behavior, revision availability and any temporary reload
      guidance in the website README. Delete this TODO when the fix ships.

### Related

- [`runner` and generated page scripts](../page/module.f.mjs).
- [`startDemo`](../demo-runtime.mjs) and
  [`startBrowserTestSources`](../../emergent_testing/browser/module.mjs).
- [Use `importmap` as `package-lock.json`](./use-importmap-as-package-lock-json.md)
  — related dependency-locking work; an import map alone does not make mutable
  module targets immutable.
- [Cloudflare static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).
- [Cloudflare versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)
  and [Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
  — retained snapshots and explicit version access are distinct from production routing.
