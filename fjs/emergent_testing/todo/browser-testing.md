## browser-testing. Run FunctionalScript proofs inside real browsers

**Priority:** P2
**Status:** wip

### Problem

FunctionalScript now has a first website-hosted path that executes proof
functions and their module dependencies inside a browser JavaScript realm. It
generates a proof-source manifest, loads modules with native `import()`, runs
recursive proofs, and renders a serializable report. The shared application
boundary, dependency-graph rejection, automated browser controllers, and
cross-browser validation described below are still missing.

An earlier revision of this plan was built around transpiling authored `.f.ts`
to browser-loadable `.f.js`. That premise is gone: authored source is `.f.mjs`
— JavaScript that browsers load natively as ES modules — so no transpile,
type-erasure, or import-rewriting step exists anywhere in this design. (After
[stage 2](../../fsc/README.md#stage-2-mark-compiler-compatible-functionalscript),
compiler-compatible modules rename to authored `.f.js`; that changes
extensions below, nothing else.)

Passing an individual function to `page.evaluate()` is not a general
replacement: the function is reconstructed from source text and loses imported
bindings, closures, module initialization, and the rest of its dependency
graph. Browsers must load proof modules and their transitive dependencies as
normal ES modules.

### Goal

One browser-native FunctionalScript test application, exposed through three
runners:

1. open its HTML page in a normal browser;
2. `fjs browser-test`, without Playwright;
3. `playwright test ...`, dynamically loading an external `playwright/test`
   installation.

Three runners over one shared browser-side system: the same module graph,
generated HTML page, in-browser emergent-test runner, proof selection with
recursive proof semantics, and serializable result format. Do not implement
three independent test frameworks.

### Shared browser test application

```text
eventual isolated browser-test application root
├── index.html
├── _browser-test-entry.mjs
├── fjs/emergent_testing/browser/module.mjs
└── authored or copied .f.mjs / .mjs modules
```

`index.html` hosts the runner, idle until an explicit `Run` click or
controller call starts it — see
[Explicit browser test controls](browser-test-controls.md), which supersedes
auto-start below. The website integration currently loads the
generated list of proof sources with native `import()` from the repository
working tree; this is not the isolated application root described by this
section. The eventual application exposes HTML and JavaScript only — it does
not serve the repository working tree, declaration files, `types.ts` (type-only
imports are JSDoc comments and never produce a request), or paths outside the
application root. The browser runner must not import the Node effect runner,
`node:test`, Node built-ins, or Playwright.

### Scope: authored FunctionalScript only

The standing rule lives in [the README](../README.md#scope); this section is
what it means for the browser suite specifically.

**The browser suite runs `.f.mjs` and nothing else.** `website/module.f.mjs`
selects on `path.endsWith('.f.mjs')`; the generated manifest currently carries
137 modules, none of them anything else. That is the design, not a first
iteration to be widened later.

It follows from what the two kinds of module are. Authored FunctionalScript is
pure — no host objects, no `node:` imports, no promises, no `async` — so a
`.f.mjs` proof means the same thing in every runner, and the extension is a
sufficient declaration for a static selector that never imports anything. An
impure `.mjs` proof means whatever its host provides: `node:fs`, `node:vm`,
`process`, `node:test`, a filesystem, a subprocess.

**Impure `.mjs` proofs are therefore Node-only, by construction, and that is the
answer rather than a gap.** Loading JavaScript written against Node into a
browser and expecting it to test anything is a nightmare, and nobody has asked
for it; no convention for labelling a test's host changes what `node:fs` needs.
There is no work item here, and the rule is recorded because it looks like an
omission if met without context. Two things a future design would have to face,
if someone ever turns up with a concrete impure test a browser must run:
*targeting* and *describing* are different questions — `browser/proof.mjs` tests
browser code but runs in Node, so a filename convention would mislabel exactly
that file — and a declaration is a claim, so a test declaring `browser` while
importing `node:fs` is a lie the dependency-graph acceptance above has to
catch.

Two things follow that are easy to get wrong:

- **The runner's promise handling is a required guard, not decoration.**
  FunctionalScript as specified has no promises, so a conforming proof produces
  none — but selection is by filename with no content check, so a module that
  does not conform is loaded and can return one. The `instanceof Promise` check
  and the settlement behind it are what keep that from silently losing a
  sub-tree, and they are not to be deleted on the grounds that the language
  forbids the input. What *was* deleted is the `Symbol.species` recovery
  machinery, which is a different thing. See
  [imports, promises and realms](imports-promises-realms.md).
- **The impure proofs that drive the browser runner are not part of the suite.**
  `emergent_testing/browser/proof.mjs` tests browser code, but it is `.mjs`, so
  it runs under `fjs t` in Node against this module called as a library. Testing
  the browser runner and running in a browser are different things.

### Selection

The named `proof` export is the source of truth; filenames are conventions.

1. Discover every authored `.f.mjs` candidate and statically select each one
   with a named `proof` export — conventional `proof.f.mjs` files and ordinary
   `module.f.mjs` files alike — without executing it in the preparation
   process.
2. Walk each selected module's complete relative runtime dependency graph and
   accept the module only when every dependency is authored `.f.mjs` / `.mjs`
   reachable inside the application root.
3. Reject clearly — with an unsupported-dependency report, never a silent
   omission or a Node fallback — when the graph reaches a `node:` import or an
   unresolved external package.

Extending selection to generic `.mjs` modules is **not** planned — see the scope
section above, which supersedes this paragraph's earlier "optional, later"
framing. A Node-dependent proof needs `node:fs`, `node:vm`, `process` and a
filesystem, none of which a page has, and no environment metadata changes that.
What remains open is the *rejection*: a `.f.mjs` whose graph reaches a `node:`
import must be reported, which is the dependency-graph acceptance above.

### In-browser runner and report

Preserve the existing emergent-testing conventions: proof exports contain
zero-argument functions and recursively testable values, thrown exceptions
are failures unless an expected throw is declared, asynchronous
browser-compatible results are awaited, and failures retain module path, test
path, message, and stack. The final report must be serializable and
independent of the outer runner (status, browser, totals, duration, per-test
results), exposed through a documented promise or global plus a documented
completion event; a runner may also configure an HTTP endpoint to receive it.

### The three runners and shared controller code

Common controller code owns discovery, graph acceptance, application
preparation, loopback static serving, URL construction, report validation,
timeout and infrastructure-error classification, and conversion of the report
into a generic pass/fail result.

- **HTML page**: idle, loading, running, passed, failed, and
  infrastructure-error states, starting only on an explicit `Run` click or
  controller call — no auto-start via a query parameter, per
  [Explicit browser test controls](browser-test-controls.md); failed test
  paths with messages and stacks; module-loading failures distinguished from
  proof failures. The FunctionalScript website hosts the same application and
  report contract — no website-only implementation.
- **`fjs browser-test`** (`build` / `serve` / `run --browser=...`): no
  Playwright dependency; starts a loopback server, opens or launches an
  installed browser, enforces timeouts, and exits nonzero on failure.
- **`playwright test ...`**: an adapter that reuses the shared controller and
  dynamically resolves `playwright/test` from the external installation that
  launched it (explicit package root, `createRequire()` at the Playwright CLI
  root, or an adapter module installed beside Playwright), failing clearly
  when it cannot. The repository must not add `@playwright/test`,
  `playwright`, or `playwright-core` as dependencies.

### Validation

End-to-end fixtures proving: an authored `.f.mjs` proof (both `proof.f.mjs`
and a `module.f.mjs` with a named `proof` export) loads and runs in the
browser; a module without a `proof` export is not a root; a graph reaching
`node:` or an external package is rejected clearly; a proof reads `window` or
`document`; the static server rejects paths outside its root; passing and
failing reports render in the HTML UI; failures produce nonzero status from
both automated runners; crashes and timeouts classify as infrastructure
errors; Chromium, Firefox, and WebKit execute proof bodies in their own
realms; `fjs browser-test` works with Playwright absent and the Playwright
adapter resolves the external installation or fails clearly.

### Out of scope

Generic Node-dependent `.mjs` coverage in the first iteration; running Node
effect integration tests in browsers; serializing closures with
`String(function)`; repository Playwright dependencies; bundling or minifying
before the native ES-module design works; per-test browser contexts, parallel
workers, or visual regression testing.

### Tasks

- [ ] Statically select every authored `.f.mjs` module with a named `proof`
      export and accept only all-`.f.mjs`/`.mjs` dependency graphs, reporting
      unsupported dependencies clearly.
- [ ] Create the JavaScript-only application root with a generated entry
      module covering every accepted module.
- [x] Implement the first browser-compatible emergent-test runner and report
      API; its pure semantics are now `fjs t`'s too — see
      [the two runners](../README.md#the-two-runners-and-what-sharing-them-cost).
- [x] Implement the HTML UI and integrate it into the FunctionalScript
      website.
- [ ] Add shared controller code for preparation, serving, report validation,
      and timeout handling.
- [ ] Implement `fjs browser-test` without any Playwright dependency.
- [ ] Implement a Playwright Test adapter that dynamically resolves external
      `playwright/test` and reuses the shared controller.
- [ ] Run the same application in Chromium, Firefox, and WebKit.
- [ ] Add the validation fixtures above; add CI only after proof bodies
      demonstrably execute inside browsers.

### Related

- [`.f.mjs` proof discovery and coverage](f-mjs-test-and-coverage.md)
- [The two runners, and what sharing them cost](../README.md#the-two-runners-and-what-sharing-them-cost)
- [Explicit browser test controls](browser-test-controls.md)
- [authored `.f.mjs` package support](../../ci/todo/f-mjs-package-support.md)
- [project roadmap](../../../todo/plan/roadmap.md)
