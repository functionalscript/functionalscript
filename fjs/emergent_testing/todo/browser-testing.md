## browser-testing. Run FunctionalScript proofs inside real browsers

**Priority:** P2
**Status:** open

### Problem

FunctionalScript currently has no test path that executes its proof functions and module
dependencies inside browser JavaScript realms.

Playwright Test normally loads test files and runs test callbacks in Node workers. Passing
an individual proof function to `page.evaluate()` is not a general solution because the
function is reconstructed from source text and loses imported bindings, closures, module
initialization, and the rest of its dependency graph.

Browsers also cannot load the repository's `.ts` and `.f.ts` files directly. Before a
browser can run the suite, TypeScript syntax must be erased and relative import
specifiers must point to emitted JavaScript files.

### Goal

Create one browser-native FunctionalScript test application that:

- generates browser-loadable JavaScript from the selected TypeScript proof modules and
  all transitive dependencies;
- generates an HTML page that starts a special in-browser emergent-test runner;
- presents test progress and results through an ordinary browser UI;
- can be opened manually in Chrome, Firefox, Safari/WebKit-compatible environments, and
  other browsers;
- can be opened by a headless browser controller for CI;
- reports a structured final result to a local server so a headless run can choose its
  process exit status.

The browser page and in-browser runner are the test system. Playwright or another
headless-browser tool is only an optional launcher and result collector.

### Shared manual and headless test application

Use the same generated application for interactive and automated execution:

```text
browser-test output
├── index.html
├── browser-test-entry.js
├── browser-test-runner.js
├── proof modules
└── their transitive JavaScript dependencies
```

A developer starts a local server and opens `index.html` in a normal browser. CI starts
the same server, opens the same URL in a headless browser, waits for completion, and
receives the same structured report.

Do not create separate test semantics for manual and headless modes. Differences should
be limited to presentation and result transport.

### Type erasure and JavaScript output

Add a deterministic preparation step that emits browser-ready JavaScript into a temporary
or generated test directory.

The initial implementation should prefer an unbundled ES-module tree:

- preserve the source directory structure;
- erase TypeScript-only syntax;
- rewrite relative `.ts` and `.f.ts` imports to their emitted `.js` names;
- preserve source maps when practical;
- emit no declarations into the browser-test output;
- avoid committing the emitted JavaScript unless a separate generated-artifact policy
  requires it.

Using `tsc` with a dedicated browser-test configuration is acceptable. A narrower type
stripper or the FunctionalScript compiler may replace it later, but the first correct
browser suite should not wait for the self-hosted compiler.

The browser must never be asked to parse TypeScript source. Add validation that the test
page makes no `.ts` requests.

### Proof discovery and generated entry module

A build-side tool may use filesystem access to discover proof modules. Browsers cannot
discover repository files themselves.

Generate a browser entry module or manifest containing explicit imports of every selected
proof module, for example:

```js
import * as proof0 from './fjs/foo/proof.js'
import * as proof1 from './fjs/bar/proof.js'
import { runModuleMap } from './browser-test-runner.js'

export const run = () => runModuleMap({
    'fjs/foo/proof.js': proof0,
    'fjs/bar/proof.js': proof1,
})
```

`index.html` may reference this one generated entry module rather than listing every
transitive dependency. Standard browser ES-module loading will fetch and evaluate the
full dependency graph recursively. Generating one `<script type="module">` element per
proof module is also acceptable when it simplifies incremental loading or UI reporting.

Each browser must independently load and evaluate the complete graph required by the
selected browser-compatible proofs.

### In-browser test runner

Create a browser-compatible emergent-test runner that preserves the existing proof
conventions where possible:

- proof modules export zero-argument functions and recursively testable values;
- thrown exceptions represent failures unless the proof declares an expected throw;
- arrays and objects are traversed using the existing emergent-testing semantics;
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

Keep the report format independent of the browser-launch mechanism.

### HTML user interface

Generate or maintain an HTML UI that can be used directly by a developer. It should:

- identify the current browser and test build;
- provide a clear Run or Re-run control;
- optionally auto-start through a query parameter for CI;
- display loading, running, passed, failed, and infrastructure-error states;
- show progress and final totals;
- list failed test paths with messages and stacks;
- make module-load failures distinct from proof failures;
- retain the final structured report on a documented global value or expose it through a
  documented browser event.

The UI should remain simple and dependency-free initially. Styling, filtering, and rich
inspection can be extended later.

### Local server and result reporting

Serve the generated application over loopback HTTP. Do not depend on `file:` URLs,
because browser module loading and origin rules differ across browsers.

For manual use, the page may display results without reporting them anywhere.

For headless use, assign a run identifier and pass a report endpoint in the page URL or
configuration. When the suite finishes, the page posts its `BrowserTestReport` to the
local server. The server:

1. serves the HTML and emitted modules;
2. receives exactly one final report for the run identifier;
3. rejects malformed, duplicate, or mismatched reports;
4. handles browser crashes and timeouts as infrastructure failures;
5. returns a nonzero process exit status when tests fail or no valid report arrives;
6. shuts down cleanly after the browser run.

Streaming progress events may be added later; a single final POST is sufficient for the
first implementation.

### Browser launch alternatives

Keep browser execution independent from the HTML test application so multiple launchers
remain possible.

#### Playwright library

A globally or Nix-provided Playwright library may launch Chromium, Firefox, and WebKit,
open the generated page, and wait for the server report. Playwright must not own test
discovery or proof semantics, and the FunctionalScript repository does not need
`@playwright/test`.

#### Direct headless browsers

Chrome/Chromium, Firefox, and available WebKit-based browser executables may be launched
directly in headless mode. The implementation must still provide reliable completion,
timeout, crash detection, and exit status rather than merely opening the URL.

Investigate whether the available WebKit environment provides a practical standalone
headless control path on every CI platform. Using Playwright as the launcher remains
acceptable when it is the simplest portable way to control WebKit.

Choose the launcher after a small prototype. The generated page, test runner, and report
protocol must not depend on that choice.

### Browser-compatible suite

Not every repository proof is necessarily browser-compatible. Node-specific modules may
import `node:fs`, `node:process`, child processes, or the Node effect interpreter.

Define an explicit browser-suite policy. Possible starting rules include:

- include proofs for pure FunctionalScript modules and browser-specific modules;
- exclude modules explicitly marked as Node-only;
- fail preparation when a selected browser proof reaches a `node:` import;
- never silently fall back to executing an incompatible proof in Node.

The long-term objective is to run every environment-independent FunctionalScript proof
inside all supported browsers, while retaining separate integration tests for
platform-specific effects.

### Commands

The exact command names may be selected during implementation. A possible interface is:

```sh
fjs browser-test build
fjs browser-test serve
fjs browser-test run --browser=firefox
```

The manual workflow may combine build and serve, while CI may combine all three steps.
Do not make command naming block the first working browser page.

### Validation

Add a small end-to-end fixture proving the architecture before enabling the full suite:

- a `.ts` proof is emitted as `.js` and loaded without any `.ts` request;
- the proof reads `window`, `document`, or another browser-only global;
- the proof imports a helper module, proving that transitive dependencies load normally;
- the browser entry loads multiple proof modules;
- a passing run produces a successful structured report;
- a deliberate proof failure appears in the HTML UI and produces a nonzero headless exit;
- a syntax error, missing module, browser crash, and report timeout are infrastructure
  failures rather than passing tests;
- Chrome/Chromium, Firefox, and WebKit each execute the proof inside their own realm;
- manual and headless execution use the same generated HTML and in-browser runner;
- `npm run ci-update` remains clean when generated CI commands are introduced.

### Out of scope

- running Node-only effect integration tests in browsers;
- serializing arbitrary JavaScript closures with `String(function)`;
- duplicating Playwright Test fixtures, retries, or assertion APIs;
- bundling or minifying the suite before the native ES-module design works;
- per-test browser contexts and parallel browser workers;
- visual regression testing;
- Docker, OCI publication, or cache design.

### Tasks

- [ ] Define the browser-compatible proof selection policy.
- [ ] Add a dedicated TypeScript-to-browser-JavaScript preparation configuration.
- [ ] Rewrite emitted relative TypeScript import extensions to JavaScript extensions.
- [ ] Generate a proof manifest or entry module with explicit proof-module imports.
- [ ] Implement the browser-compatible emergent-test runner.
- [ ] Generate the HTML test UI and support manual Run/Re-run behavior.
- [ ] Add loopback static serving for the generated application.
- [ ] Define the serializable browser-test report and final-report HTTP endpoint.
- [ ] Add automatic start and report configuration for headless runs.
- [ ] Prototype Playwright-library and direct-browser launch paths, then choose the
      simplest reliable CI controller.
- [ ] Run the same application inside Chromium, Firefox, and WebKit.
- [ ] Add browser-realm, dependency-graph, type-erasure, failure, timeout, and reporting
      tests.
- [ ] Add CI only after the proof bodies demonstrably execute inside the browsers.

### Related

- [../../ci/todo/remove-playwright-job.md](../../ci/todo/remove-playwright-job.md) — removes
  the current Node-only Playwright integration before this replacement is implemented.
