## Share the browser and console proof runners

**Priority:** P3
**Status:** open

### Problem

The browser runner and `fjs t` currently implement the same proof semantics in
different places. In particular, both must discover zero-argument leaves, walk
returned proof trees, propagate the structural `throw` expectation, await real
promises, format paths, count results, and distinguish proof failures from
runner failures. Keeping those rules in `emergent_testing/browser.mjs` and
`emergent_testing/module.f.mjs` independently invites behavioral drift.

The current browser file also mixes three layers:

1. pure proof-tree and result logic;
2. browser operations such as time, yielding, and module loading;
3. DOM rendering and global/event integration.

That makes the reusable semantics harder to see and leaves the impure browser
entry much larger than it needs to be.

### Preliminary design

Share semantics, not host mechanics. The console runner should keep using the
Node Effects runner and the browser should keep executing proof bodies in the
browser realm; neither runner should call through the other host's adapter.

The intended layout is:

```text
fjs/emergent_testing/
├── module.f.mjs             shared proof semantics used by every runner
├── browser/
│   ├── module.f.mjs         pure browser application/effect composition
│   └── module.mjs           minimal browser host runner and DOM integration
└── ...                      existing console/external-runner adapters

fjs/effects/browser/         browser operations and interpreter, only if useful
├── module.f.mjs             operation constructors/composition
├── module.mjs               browser interpreter
└── types.ts                 operation types
```

Website preparation follows the same boundary. Restore the package command to
the FunctionalScript entry point:

```json
"index-html": "node ./fjs/module.mjs r ./fjs/website/module.f.mjs"
```

`fjs/website/module.f.mjs` must own proof discovery, manifest generation, and
HTML/entry generation as one `NodeProgram`. Do not invoke a non-FunctionalScript
preparation script such as `website/browser-prepare.mjs` directly from an npm
script. If preparation needs a Node capability that the FunctionalScript
program cannot currently express, add the smallest operation to
`fjs/effects/node/` and its real and virtual interpreters instead of bypassing
Effects. Existing `readdir`, `readFile`, and `writeFile` operations should be
reused where sufficient.

Move `emergent_testing/browser.mjs` to
`emergent_testing/browser/module.mjs`. It should become a thin impure shell:
provide browser capabilities, start the pure program, render semantic events,
publish `window.fjsBrowserTestReport`, and dispatch the completion event. Pure
code belongs in `emergent_testing/browser/module.f.mjs` or in the shared
`emergent_testing/module.f.mjs`, depending on whether console runners can use
it.

Extract or reuse these host-independent concepts first:

- proof-tree parsing and recursive path handling (`collectTests` already exists
  and should be the source of truth rather than being copied);
- expected-throw semantics;
- normalized per-test results and total/result reducers;
- report status and infrastructure-error classification;
- semantic progress events, independent of terminal text or DOM elements.

Keep host capabilities at the leaves. Candidate browser effects are module
import, monotonic time, event-loop yield, and report publication. DOM node
construction may instead remain in the small `module.mjs` adapter if making it
an effect adds an operation for every DOM detail without improving the shared
API. Add `fjs/effects/browser/` only after the required operation set is clear;
do not create a mirror of `effects/node` merely for directory symmetry.

An executor boundary will still be necessary because the console runner uses
the Effects sandbox while a browser catches synchronous throws and awaits
native promises. That boundary should answer one normalized leaf result. Tree
walking, throw inversion, aggregation, and reporting policy stay above it and
are shared.

### Constraints

- Preserve the recursive proof semantics and totals of `fjs t` exactly,
  including objects with a proof property named `then`; only actual promises
  are asynchronous values.
- Browser modules must not import Node built-ins, the Node effect interpreter,
  `node:test`, or Playwright.
- Website build-time filesystem access must be expressed by the FunctionalScript
  `NodeProgram` through Node effects; npm scripts must not run an impure helper
  as a second application entry point.
- The browser host runner must remain usable as native JavaScript with no
  bundling or transpilation.
- Pure `.f.mjs` additions require co-located proofs with complete line,
  function, and branch coverage.
- Keep the serializable browser report, documented promise, and completion
  event compatible unless a simpler shared report API deliberately replaces
  all callers in the same change.
- Do not move terminal formatting or DOM presentation into the shared semantic
  core.

### Tasks

- [ ] Inventory duplicated semantics in `emergent_testing/module.f.mjs` and
      `emergent_testing/browser.mjs`, and define the smallest shared API.
- [ ] Make the existing `collectTests`/path behavior the single source of truth
      for console and browser execution.
- [ ] Define normalized leaf, progress, infrastructure-error, totals, and report
      values without terminal or DOM fields.
- [ ] Decide whether browser import/time/yield/publication justify
      `fjs/effects/browser/`; document the decision before adding operations.
- [ ] Move static proof discovery and `_browser-suite.mjs` generation into
      `fjs/website/module.f.mjs`; extend `fjs/effects/node/` only for a concrete
      missing capability and prove the real and virtual interpretations.
- [ ] Delete `fjs/website/browser-prepare.mjs` and restore `index-html` to
      `node ./fjs/module.mjs r ./fjs/website/module.f.mjs` once the
      FunctionalScript generator owns the complete build.
- [ ] Add `emergent_testing/browser/module.f.mjs` for pure browser application
      composition and its complete proof.
- [ ] Move the current browser host code to
      `emergent_testing/browser/module.mjs` and reduce it to capability
      interpretation, DOM rendering, and browser publication.
- [ ] Update the generated website entry and browser-test application imports
      to the new module paths.
- [ ] Prove both runners produce equivalent paths, throw outcomes, recursive
      test counts, and normalized failures from the same fixtures.

### Related

- [Browser testing](browser-testing.md) — browser-native application and runner
  requirements.
- [Test-runner behavior](661-test-runner-behavior.md) — documented differences
  that must remain intentional after sharing the core.
- [Test tree walker](65z-tf-test-tree-walker.md) — earlier work around recursive
  proof-tree traversal.
