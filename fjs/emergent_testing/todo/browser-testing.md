## browser-testing. Run FunctionalScript proofs inside real browsers

**Priority:** P2
**Status:** open

### Problem

FunctionalScript currently has no test path that executes proof functions and their
module dependencies inside browser JavaScript realms.

The existing Playwright integration registers tests in a Node worker and then executes
them through the Node effect runner. Selecting Chromium, Firefox, or WebKit does not move
those proof functions into the browser.

Passing a proof function to `page.evaluate()` is not a general solution either. The
function is reconstructed from source text and loses imported bindings, closures, module
initialization, and the rest of its dependency graph.

Browsers must instead load the proof modules and their transitive dependencies as normal
ES modules. They cannot load the repository's `.ts` or `.f.ts` source directly.

### Goal

Create one browser-native FunctionalScript test application that:

- serves an HTML page and browser-executable JavaScript modules only;
- never serves or requests `.ts` or `.f.ts` source;
- loads every selected proof module and its transitive JavaScript dependencies inside the
  browser;
- starts a browser-compatible emergent-test runner from the HTML page;
- presents progress and results through an ordinary browser UI;
- supports manual execution in installed browsers;
- supports automated execution through either FunctionalScript tooling, Playwright, or
  direct headless browsers;
- reports a structured final result to a local server for CI exit-status handling.

The HTML page and in-browser runner are the shared test system. `fjs browser-test`,
Playwright, and direct browser processes are alternative controllers for preparing or
opening the same application and collecting the same report. Playwright must remain a
valid user-facing alternative to an `fjs browser-test` command; it is not required to be
hidden behind the FunctionalScript CLI.

### JavaScript-only serving invariant

The browser-test server must expose a dedicated application root rather than the
repository working tree.

The application may contain:

```text
browser-test output
├── index.html
├── browser-test-entry.js
├── browser-test-runner.js
├── generated .js modules
└── authored or copied .mjs modules
```

Only browser-executable JavaScript module files (`.js` or `.mjs`) may be served as module
resources. The initial implementation should keep styling inline and generate a
JavaScript entry module rather than a separate JSON manifest, so the static surface is
limited to HTML and JavaScript.

The server must reject requests for at least:

- `.ts`, `.f.ts`, `.tsx`, `.mts`, and `.cts` source;
- declaration files;
- files outside the browser-test application root;
- unexpected Node or package-manager files.

Do not expose the repository root and rely on the browser to ignore TypeScript files.
The output directory is an explicit browser-ready artifact.

### Two paths to browser-ready JavaScript

There are two valid ways for a repository module to become loadable by the browser.

#### 1. Transpile remaining TypeScript source

For modules still authored as `.ts` or `.f.ts`:

- erase TypeScript-only syntax;
- emit browser-compatible ES modules as `.js` files;
- preserve the relevant source directory structure;
- rewrite relative TypeScript import extensions to emitted JavaScript paths;
- emit no declarations into the browser-test directory;
- fail when the selected graph depends on Node-only modules or unresolved imports.

Using `tsc` with a dedicated browser-test configuration is acceptable for the first
implementation. A narrower type stripper or the FunctionalScript compiler may replace it
later.

#### 2. Use authored JavaScript source

Modules already authored as `.mjs` or `.f.mjs` contain browser-parseable JavaScript and
do not require type erasure. They may be copied into the browser-test application or
served from an explicitly constructed JavaScript-only output tree.

Do not rewrite authored `.mjs` into generated `.js` merely to make the browser runner
work. Preserve the authored module and its import graph when it is already
browser-compatible.

A selected browser suite may therefore contain a mixed graph during migration:

```text
proof.f.ts       -> emitted proof.f.js
module.f.ts      -> emitted module.f.js
migrated.f.mjs   -> authored/copied migrated.f.mjs
```

The generated entry module must import the browser-output paths, not the original
TypeScript paths.

### Relationship to the `.f.mjs` migration

The repository already documents an incremental migration from `.f.ts` to `.f.mjs`:

- `.f.ts` is authored FunctionalScript-intent TypeScript;
- `.f.mjs` is authored FunctionalScript ESM JavaScript with JSDoc types and must be
  accepted by the current FunctionalScript parser/compiler;
- `.f.js` is generated JavaScript emitted from `.f.ts` and is never authored directly.

See the [FunctionalScript compiler source-file and migration
contract](../../fsc/README.md#source-files-and-incremental-repository-migration) and the
[project roadmap](../../../todo/plan/roadmap.md#future--functionalscript-compiler-via-fjsbnf).

Browser testing must support that migration instead of creating a competing convention:

1. Today, transpile selected `.f.ts` files to generated `.f.js` for browser execution.
2. Load eligible authored `.f.mjs` files directly as JavaScript modules.
3. As dependency-closed module groups migrate to `.f.mjs`, reduce the portion of the
   browser suite that needs transpilation.
4. Do not block browser testing on whole-repository migration, and do not migrate files
   merely to satisfy this task.

The existing [`.f.mjs` test and coverage task](f-mjs-test-and-coverage.md) remains the
owner of proof discovery and coverage support for authored `.f.mjs`. The browser runner
must consume the same extension policy and must not create a second incompatible proof
selection rule.

### Shared manual and headless test application

Use the same generated application for interactive and automated execution.

A developer starts a loopback server and opens `index.html` in a normal browser. CI
starts the same server, opens the same URL in a headless browser, waits for completion,
and receives the same structured report.

Do not create separate test semantics for manual, FunctionalScript-controlled,
Playwright-controlled, and direct-headless modes. Differences should be limited to
preparation, server lifecycle, auto-start configuration, presentation, and result
transport.

### Proof discovery and generated entry module

A build-side tool may use filesystem access to discover proof modules. Browsers cannot
discover repository files themselves.

Generate a JavaScript entry module containing explicit imports of every selected proof
module, for example:

```js
import * as proof0 from './fjs/foo/proof.js'
import * as proof1 from './fjs/bar/proof.js'
import * as proof2 from './fjs/migrated/proof.f.mjs'
import { runModuleMap } from './browser-test-runner.js'

export const run = () => runModuleMap({
    'fjs/foo/proof.js': proof0,
    'fjs/bar/proof.js': proof1,
    'fjs/migrated/proof.f.mjs': proof2,
})
```

`index.html` references this entry module. Standard browser ES-module loading then fetches
and evaluates the complete transitive dependency graph.

Each browser must independently load and evaluate the complete graph required by the
selected browser-compatible proofs. Do not serialize proof functions with
`String(function)`.

### In-browser test runner

Create a browser-compatible emergent-test runner that preserves existing proof
conventions where practical:

- proof modules export zero-argument functions and recursively testable values;
- thrown exceptions represent failures unless the proof declares an expected throw;
- arrays and objects use the existing emergent-testing traversal semantics;
- asynchronous browser-compatible results are awaited;
- failures retain module path, test path, message, and stack when available;
- the final report is serializable data.

The browser runner must not import the Node effect runner, `node:test`, Node built-ins, or
Playwright APIs.

A minimal report shape may include:

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

This TypeScript shape documents the protocol; browser-delivered implementation files must
be JavaScript.

### HTML user interface

Generate or maintain a simple dependency-free HTML UI that:

- identifies the current browser and test build;
- provides a Run or Re-run control;
- optionally auto-starts through a query parameter for CI;
- displays loading, running, passed, failed, and infrastructure-error states;
- shows progress and final totals;
- lists failed test paths with messages and stacks;
- distinguishes module-load failures from proof failures;
- retains the final structured report on a documented global value or emits a documented
  browser event.

Keep CSS inline initially so no additional static resource type is required.

### Local server and result reporting

Serve the generated application over loopback HTTP. Do not depend on `file:` URLs,
because browser module loading and origin behavior differ across browsers.

For manual use, the page may display results without reporting them anywhere.

For automated use, assign a run identifier and pass a report endpoint through the page
URL or generated configuration. When the suite finishes, the page posts its
`BrowserTestReport` to the local server. The server:

1. serves only `index.html` and the JavaScript-only browser-test application;
2. receives exactly one final report for the run identifier;
3. rejects malformed, duplicate, or mismatched reports;
4. handles browser crashes and timeouts as infrastructure failures;
5. returns a nonzero process exit status when tests fail or no valid report arrives;
6. shuts down cleanly after the browser run.

Streaming progress events may be added later; one final POST is sufficient initially.
The report protocol must be usable by an `fjs browser-test` process, a Playwright test or
library adapter, and a direct-browser controller without changing the page's test
semantics.

### Controller and command alternatives

Keep preparation, browser execution, and result collection independent from the HTML test
application. The implementation may expose more than one controller over the same test
artifact.

#### FunctionalScript browser-test command

FunctionalScript may provide its own controller, for example:

```sh
fjs browser-test build
fjs browser-test serve
fjs browser-test run --browser=firefox
```

It may own proof discovery, JavaScript preparation, loopback serving, browser process
lifecycle, report validation, and exit status.

This command is useful but not mandatory for every execution environment. Do not design
the generated page so only the FunctionalScript controller can run it.

#### Playwright

Playwright may be used directly as an alternative to `fjs browser-test`, not merely as an
internal implementation detail of that command.

A globally or Nix-provided Playwright Test adapter or Playwright-library controller may:

- prepare or reuse the same JavaScript-only browser-test output;
- start or connect to the same loopback server;
- open the same `index.html` in Chromium, Firefox, or WebKit;
- wait for the same structured browser report;
- translate that report into Playwright success or failure.

A possible direct interface is:

```sh
playwright test --project=firefox
```

The Playwright adapter may live in the globally or Nix-provided environment so the
repository does not need `@playwright/test`. Playwright must not redefine proof discovery,
recursive proof semantics, or the report format; those remain owned by the generated
browser application.

#### Direct headless browsers

Chrome/Chromium, Firefox, and available WebKit-based executables may be launched directly
in headless mode. The controller must provide reliable completion, timeout, crash
detection, and exit status rather than merely opening the URL.

Investigate whether the available WebKit environment provides a practical standalone
headless path on every CI platform. Using Playwright remains acceptable when it is the
simplest portable way to control WebKit.

The project may choose one controller for CI without removing the other supported entry
points. The generated HTML application, JavaScript module graph, test runner, and report
protocol must not depend on whether the caller is `fjs browser-test`, Playwright, or a
direct browser process.

### Browser-compatible suite

Not every repository proof is browser-compatible. Node-specific modules may import
`node:fs`, `node:process`, child processes, or the Node effect interpreter.

Define an explicit browser-suite policy:

- include proofs for pure FunctionalScript modules and browser-specific modules;
- include both emitted `.js` proofs and authored `.mjs` proofs;
- exclude modules explicitly marked as Node-only;
- fail preparation when a selected browser proof reaches a `node:` import;
- never silently execute an incompatible proof in Node.

The long-term objective is to run every environment-independent FunctionalScript proof
inside all supported browsers while retaining separate integration tests for
platform-specific effects.

### Command selection

Do not require one universal command before the browser application exists. Valid entry
points may include:

```sh
fjs browser-test run --browser=firefox
playwright test --project=firefox
firefox --headless http://127.0.0.1:<port>/index.html?...
```

These commands are alternatives over the same generated application, not three different
test systems. CI may select the simplest reliable controller for each environment.

### Validation

Add a small end-to-end fixture proving the architecture before enabling the full suite:

- a `.ts` proof is emitted as `.js` and loaded without any TypeScript request;
- an authored `.mjs` proof is loaded without transpilation;
- a mixed `.js`/`.mjs` dependency graph loads correctly;
- the proof reads `window`, `document`, or another browser-only global;
- the proof imports a helper module, proving that transitive dependencies load normally;
- the browser entry loads multiple proof modules;
- the static server rejects `.ts` requests and paths outside its output root;
- browser network logs contain no `.ts`, declaration, JSON-manifest, or source-map
  requests;
- a passing run produces a successful structured report;
- a deliberate proof failure appears in the HTML UI and produces a nonzero automated
  exit status;
- a syntax error, missing module, browser crash, and report timeout are infrastructure
  failures rather than passing tests;
- Chromium, Firefox, and WebKit each execute the proof inside their own realm;
- manual, `fjs browser-test`, Playwright, and direct-headless execution use the same
  generated HTML and in-browser runner;
- at least one end-to-end test exercises the Playwright entry point independently of
  `fjs browser-test`;
- `npm run ci-update` remains clean when generated CI commands are introduced.

### Out of scope

- running Node-only effect integration tests in browsers;
- serializing arbitrary JavaScript closures with `String(function)`;
- duplicating Playwright Test fixtures, retries, or assertion APIs inside the browser
  runner;
- bundling or minifying the suite before the native ES-module design works;
- migrating all `.f.ts` files to `.f.mjs` as part of browser-test implementation;
- changing the existing `.f.mjs` migration or authored/generated extension contract;
- requiring every environment to support every controller interface;
- per-test browser contexts and parallel browser workers;
- visual regression testing;
- Docker, OCI publication, or cache design.

### Tasks

- [ ] Define the browser-compatible proof selection policy shared with existing `.f.mjs`
      proof discovery.
- [ ] Create a dedicated browser-test output root that cannot serve repository TypeScript
      files.
- [ ] Add TypeScript-to-browser-JavaScript emission for selected `.ts` and `.f.ts` files.
- [ ] Rewrite emitted relative TypeScript import extensions to JavaScript extensions.
- [ ] Copy or expose selected authored `.mjs` and `.f.mjs` modules without type erasure.
- [ ] Generate a JavaScript entry module with explicit proof-module imports.
- [ ] Implement the browser-compatible emergent-test runner in JavaScript.
- [ ] Generate the HTML test UI with inline styling and Run/Re-run behavior.
- [ ] Add loopback serving restricted to HTML and JavaScript application files.
- [ ] Define the serializable browser-test report and final-report HTTP endpoint.
- [ ] Keep the report protocol independent of `fjs browser-test`, Playwright, and direct
      browser controllers.
- [ ] Add automatic start and report configuration for automated runs.
- [ ] Prototype an `fjs browser-test` controller, a direct Playwright entry point, and
      direct-browser launching; select the simplest reliable controller for CI without
      making the others incompatible.
- [ ] Run the same application inside Chromium, Firefox, and WebKit.
- [ ] Add JavaScript-only serving, browser-realm, mixed-source dependency, controller
      independence, failure, timeout, and reporting tests.
- [ ] Add CI only after proof bodies demonstrably execute inside the browsers.

### Related

- [FunctionalScript compiler source-file and migration
  contract](../../fsc/README.md#source-files-and-incremental-repository-migration)
- [project compiler and incremental-migration
  roadmap](../../../todo/plan/roadmap.md#future--functionalscript-compiler-via-fjsbnf)
- [`.f.mjs` proof discovery and coverage](f-mjs-test-and-coverage.md)
- [authored `.f.mjs` package support](../../ci/todo/f-mjs-package-support.md)
- [remove the current Playwright job](../../ci/todo/remove-playwright-job.md)
