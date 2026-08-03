## browser-testing. Run FunctionalScript proofs inside real browsers

**Priority:** P2
**Status:** open

### Problem

FunctionalScript currently has no test path that executes proof functions and their
module dependencies inside browser JavaScript realms.

The previous Playwright integration registered proofs in a Node worker and executed them
through the Node effect runner, so selecting Chromium, Firefox, or WebKit did not move the
proof code into those browsers. That integration has been removed.

Passing an individual function to `page.evaluate()` is not a general replacement. The
function is reconstructed from source text and loses imported bindings, closures, module
initialization, and the rest of its dependency graph.

Browsers must load proof modules and all transitive dependencies as normal ES modules.
They also cannot load the repository's `.ts` and `.f.ts` source directly.

### Goal

Create one browser-native FunctionalScript test application and expose three ways to run
it:

1. open its HTML page in a normal browser;
2. run it through `fjs browser-test` without Playwright;
3. run it through `playwright test ...` using a dynamically loaded external
   `playwright/test` installation.

These are three runners over one shared browser-side test system. They must use the same:

- browser-ready JavaScript module graph;
- generated HTML page;
- in-browser emergent-test runner;
- proof selection and recursive proof semantics;
- serializable result format.

Do not implement three independent test frameworks.

### Shared browser test application

Generate or publish an application with a shape similar to:

```text
browser-test output
├── index.html
├── browser-test-entry.js
├── browser-test-runner.js
├── generated .f.js modules
└── authored or copied .f.mjs modules
```

`index.html` starts the browser-compatible runner. The entry module explicitly imports
every selected module that exports `proof`. Native browser ES-module loading then resolves
and evaluates the full transitive dependency graph.

The browser runner must not import:

- the Node effect runner;
- `node:test`;
- Node built-ins;
- Playwright or `playwright/test`.

Playwright belongs only to the Playwright runner outside the page.

### JavaScript-only application

The browser-test application must expose HTML and executable JavaScript only. It must not
serve the repository working tree.

Only `.js` and `.mjs` files may be requested as module resources. The server or static
host must reject or omit:

- `.ts`, `.f.ts`, `.tsx`, `.mts`, and `.cts` source;
- declaration files;
- files outside the generated application root;
- unexpected Node, package-manager, or repository metadata files.

Keep initial styling inline in `index.html`, and generate a JavaScript entry module rather
than requiring a separate JSON manifest. The browser must never be asked to parse
TypeScript.

### Two paths to browser-ready JavaScript

#### Transpile remaining FunctionalScript TypeScript

For selected modules still authored as `.f.ts`:

- erase TypeScript-only syntax;
- emit browser-compatible ES modules as `.f.js`;
- preserve the needed directory structure;
- rewrite relative `.f.ts` imports to emitted `.f.js` paths;
- emit no declarations into the browser-test application;
- reject unresolved and unsupported dependencies.

A dedicated `tsc` configuration is acceptable initially. A narrower type stripper or the
FunctionalScript compiler may replace it later.

#### Use authored FunctionalScript JavaScript

Modules already authored as `.f.mjs` are JavaScript and do not require type erasure. Copy
them into the application, or expose them through an explicitly constructed
JavaScript-only output tree.

Do not rewrite authored `.f.mjs` to generated `.f.js` merely for browser testing.

A mixed migration graph is expected:

```text
proof.f.ts       -> generated proof.f.js
module.f.ts      -> generated module.f.js
migrated.f.mjs   -> authored/copied migrated.f.mjs
```

The generated entry module imports application paths, never original TypeScript paths.

### Relationship to `.f.mjs` migration

The repository already defines:

- `.f.ts` as authored FunctionalScript-intent TypeScript;
- `.f.mjs` as authored FunctionalScript ESM JavaScript with JSDoc types;
- `.f.js` as generated JavaScript emitted from `.f.ts`.

See the [compiler source-file and migration
contract](../../fsc/README.md#source-files-and-incremental-repository-migration) and the
[project roadmap](../../../todo/plan/roadmap.md#future--functionalscript-compiler-via-fjsbnf).

Browser testing follows this migration rather than creating another convention:

1. transpile selected `.f.ts` files today;
2. load eligible `.f.mjs` files directly;
3. reduce transpilation as dependency-closed groups migrate;
4. do not block browser testing on complete repository migration;
5. do not migrate modules merely to satisfy this task.

Reuse the proof-extension policy owned by [`.f.mjs` test and coverage
support](f-mjs-test-and-coverage.md).

### Initial browser-suite selection

The first implementation does not need a new Node-only marker. It uses the file-extension
boundary already provided by FunctionalScript, while preserving the existing rule that a
`proof` export may live in any FunctionalScript module rather than only in a file named
`proof`.

Select browser proofs deterministically as follows:

1. Discover every authored FunctionalScript module candidate:
   - any `.f.ts` file;
   - any `.f.mjs` file.
2. Select each candidate that has a named `proof` export. This includes conventional
   `proof.f.ts` / `proof.f.mjs` files and ordinary files such as `module.f.ts` /
   `module.f.mjs` that export their proofs directly.
3. Identify the export without executing the candidate in the Node preparation process.
   Use the TypeScript/FunctionalScript parser, emitted-module metadata, or another static
   mechanism consistent with the existing `proofEntries` semantics.
4. Map a selected `.f.ts` source to its generated `.f.js` path; keep a selected `.f.mjs`
   source as authored JavaScript.
5. Walk each selected module's complete relative runtime dependency graph.
6. Accept the module only when every runtime dependency in that graph becomes either:
   - generated `.f.js` from `.f.ts`; or
   - authored/copied `.f.mjs`.
7. Reject the selected module with a clear unsupported-dependency report when the graph
   reaches:
   - a `node:` import;
   - a generic `.ts`, `.js`, or `.mjs` runtime module;
   - an unresolved or external package import not explicitly supported by the browser
     application.
8. Never silently omit an accepted module or dependency, and never fall back to running
   its proof in Node.

The named-export rule is the source of truth; filenames are only conventions. A
browser-compatible `module.f.ts` with `export const proof = ...` must be included, while a
`proof.f.ts` with an unsupported dependency graph must be rejected clearly.

This deliberately limits the first browser suite to FunctionalScript files. Extending
browser testing later to generic `proof.ts`, `module.ts`, `.js`, or `.mjs` modules is
optional and lower priority. That extension may introduce a naming convention or explicit
environment metadata for Node-dependent generic modules, but it does not block the first
working browser suite.

### Proof discovery and entry generation

Filesystem discovery may run outside the browser. Generate an entry module such as:

```js
import * as proof0 from './fjs/foo/proof.f.js'
import * as proof1 from './fjs/bar/module.f.js'
import * as proof2 from './fjs/migrated/module.f.mjs'
import { runModuleMap } from './browser-test-runner.js'

export const run = () => runModuleMap({
    'fjs/foo/proof.f.js': proof0,
    'fjs/bar/module.f.js': proof1,
    'fjs/migrated/module.f.mjs': proof2,
})
```

`runModuleMap` applies the same module-level `proof` export handling to every entry. It
must not assume that only `proof.f.*` files contain tests.

Emitted names retain the `.f` segment: `proof.f.ts` becomes `proof.f.js`, and
`module.f.ts` becomes `module.f.js`.

Each browser independently loads and evaluates the complete graph. Never serialize proof
functions with `String(function)`.

### In-browser runner and report

Preserve existing emergent-testing conventions where practical:

- each selected module contributes its named `proof` export;
- proof exports contain zero-argument functions and recursively testable values;
- thrown exceptions are failures unless an expected throw is declared;
- arrays and objects use the existing recursive test semantics;
- asynchronous browser-compatible results are awaited;
- failures retain module path, test path, message, and stack when available.

The final result must be serializable and independent of the outer runner. A possible
shape is:

```ts
type BrowserTestReport = {
    readonly status: 'passed' | 'failed' | 'error'
    readonly browser: string
    readonly total: number
    readonly passed: number
    readonly failed: number
    readonly durationMs: number
    readonly tests: readonly BrowserTestResult[]
}
```

This TypeScript declaration documents the protocol; browser-delivered implementation
files remain JavaScript.

The page should expose completion through a stable browser API, for example both:

- a documented promise or global containing the final report;
- a documented browser event emitted when the report is ready.

A runner may also configure an HTTP endpoint to receive the final report.

## Runner 1: HTML page in a browser

The simplest runner is the page itself.

A developer opens the hosted browser-test page, presses Run or Re-run, and reads the
results in the UI. The page should:

- identify the browser and test build;
- show loading, running, passed, failed, and infrastructure-error states;
- display progress and totals;
- list failed test paths, messages, and stacks;
- distinguish module-loading failures from proof failures;
- support automatic start through a query parameter when needed.

The same browser test application should be integrated into the FunctionalScript website.
The website integration may host a committed or generated release artifact, but it must
use the same browser runner and report contract as local and automated execution. Avoid a
website-only test implementation.

A hosted website run does not need to post results to a local server; displaying and
retaining the report in the page is sufficient.

## Runner 2: `fjs browser-test`

FunctionalScript may provide commands such as:

```sh
fjs browser-test build
fjs browser-test serve
fjs browser-test run --browser=firefox
```

This runner must not depend on Playwright or `playwright/test`.

It may:

- discover browser-compatible FunctionalScript modules with `proof` exports using the
  initial selection algorithm;
- prepare the JavaScript-only application;
- start a loopback HTTP server;
- open the URL in an installed browser or instruct the user to open it;
- optionally launch a browser directly in headless mode;
- receive or inspect the shared final report;
- enforce timeout and crash handling;
- return a nonzero exit status for failed tests or infrastructure errors.

The exact browser-launch mechanism is an implementation decision, but the command must
remain usable in an environment with no Playwright installation.

## Runner 3: `playwright test ...`

Playwright Test is a separate supported runner, not merely an internal implementation of
`fjs browser-test`.

A possible interface is:

```sh
playwright test --project=firefox
```

The Playwright adapter should share the proof selection, preparation, static server,
browser page, report protocol, and result interpretation code used by
`fjs browser-test`. It additionally uses Playwright Test for:

- browser and project selection;
- `page` and browser lifecycle fixtures;
- Playwright reporting and process integration;
- optional traces, screenshots, and diagnostics added later.

The repository must not add `@playwright/test`, `playwright`, or `playwright-core` as a
`devDependency` merely to provide this runner.

Instead, the adapter dynamically loads `playwright/test` from the Playwright installation
that launched the command. A conceptual adapter may use top-level asynchronous loading:

```js
const { test, expect } = await loadPlaywrightTest()

test('FunctionalScript browser suite', async ({ page }) => {
    const report = await runSharedBrowserApplication(page)
    expect(report.status).toBe('passed')
})
```

A plain repository-relative `import('playwright/test')` may not resolve a globally or
Nix-installed package. The implementation must deliberately resolve the module from the
active Playwright installation, for example through:

- an explicit package root supplied by the Nix/global launcher;
- `createRequire()` rooted at the Playwright CLI installation;
- an adapter module installed beside Playwright that imports `playwright/test` and then
  loads the repository's shared adapter code.

Choose the simplest reliable mechanism, document it, and fail clearly when the external
Playwright Test installation cannot be found. Do not silently fall back to Node-only
proof execution.

The dynamically loaded module and matching browsers must come from the same external or
Nix-provided Playwright installation.

### Shared controller code

Separate common controller logic from runner-specific integration.

Common code should own:

- discovery of FunctionalScript modules with named `proof` exports;
- dependency-graph acceptance and rejection;
- JavaScript application preparation;
- loopback static serving;
- URL and run-identifier construction;
- report validation;
- timeout and infrastructure-error classification;
- conversion of `BrowserTestReport` into a generic pass/fail result.

`fjs browser-test` adds direct browser launching and CLI exit behavior.

The Playwright adapter adds dynamic `playwright/test` loading, fixture registration, and
Playwright reporting.

The HTML runner uses only the generated page and browser-side code.

### Validation

Add end-to-end fixtures proving:

- a `proof.f.ts` module is emitted and imported as `proof.f.js`;
- a `module.f.ts` with a named `proof` export is emitted and included as `module.f.js`;
- an authored `.f.mjs` module with a named `proof` export loads without transpilation;
- an eligible FunctionalScript module without a `proof` export is not added as a root;
- a mixed `.f.js`/`.f.mjs` dependency graph loads correctly;
- a selected module whose graph reaches generic `module.ts` or `node:` is rejected clearly;
- no TypeScript request occurs in the browser;
- a proof reads `window`, `document`, or another browser-only global;
- transitive FunctionalScript helper modules load through native ES-module imports;
- the static server rejects TypeScript and paths outside its application root;
- passing and failing reports appear correctly in the HTML UI;
- a failed proof produces nonzero status from both automated runners;
- syntax errors, missing modules, crashes, and timeouts are infrastructure failures;
- Chromium, Firefox, and WebKit execute proof bodies inside their own realms;
- the website, `fjs browser-test`, and Playwright use the same browser-side runner and
  report shape;
- `fjs browser-test` works with Playwright packages absent;
- `playwright test ...` works with Playwright absent from repository dependencies;
- the Playwright adapter resolves `playwright/test` from the external installation and
  fails clearly when it is unavailable;
- `npm run ci-update` remains clean when generated CI is introduced.

### Out of scope

- generic `proof.ts` and `module.ts` browser coverage in the first implementation;
- defining a Node-only marker for generic modules before generic modules are selected;
- running Node-only effect integration tests in browsers;
- serializing arbitrary JavaScript closures with `String(function)`;
- duplicating Playwright Test fixtures or assertions inside the browser runner;
- adding repository Playwright dependencies;
- bundling or minifying before the native ES-module design works;
- migrating all `.f.ts` files to `.f.mjs` as part of browser testing;
- changing the existing `.f.mjs` extension contract;
- per-test browser contexts or parallel workers in the first iteration;
- visual regression testing;
- Docker, OCI publication, or cache design.

### Tasks

- [ ] Discover all `.f.ts` and `.f.mjs` module candidates and statically select every
      module with a named `proof` export, regardless of filename.
- [ ] Map selected `.f.ts` modules to `.f.js` while preserving selected `.f.mjs` modules.
- [ ] Accept only dependency graphs that map completely to `.f.js` and `.f.mjs` modules.
- [ ] Report unsupported generic, Node, external, and unresolved dependencies clearly.
- [ ] Create a JavaScript-only browser-test output root.
- [ ] Add `.f.ts` to `.f.js` emission and rewrite relative FunctionalScript imports.
- [ ] Copy selected authored `.f.mjs` modules without type erasure.
- [ ] Generate a JavaScript entry module containing every accepted module with a `proof`
      export, including `module.f.*` files.
- [ ] Implement the browser-compatible emergent-test runner and report API.
- [ ] Implement the HTML UI and integrate it into the FunctionalScript website.
- [ ] Add shared controller code for preparation, serving, report validation, and timeout
      handling.
- [ ] Implement `fjs browser-test` without any Playwright dependency.
- [ ] Implement a Playwright Test adapter that dynamically resolves external
      `playwright/test`.
- [ ] Ensure the Playwright adapter and `fjs browser-test` reuse shared controller code.
- [ ] Run the same application in Chromium, Firefox, and WebKit.
- [ ] Add website, no-Playwright CLI, external-Playwright, browser-realm, selection,
      module-level-proof, failure, and timeout tests.
- [ ] Add CI only after proof bodies demonstrably execute inside browsers.

### Related

- [FunctionalScript compiler source-file and migration
  contract](../../fsc/README.md#source-files-and-incremental-repository-migration)
- [project compiler and incremental-migration
  roadmap](../../../todo/plan/roadmap.md#future--functionalscript-compiler-via-fjsbnf)
- [`.f.mjs` proof discovery and coverage](f-mjs-test-and-coverage.md)
- [authored `.f.mjs` package support](../../ci/todo/f-mjs-package-support.md)
