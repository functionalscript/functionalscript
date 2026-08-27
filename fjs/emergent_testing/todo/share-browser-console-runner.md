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

### How to do this — read before designing

An attempt at this issue was written, reviewed, approved and then reverted. It
worked: one shared `runModuleMap`, a `Reporter` per host, an `effects/common`
layer, a browser interpreter, 100% coverage, green CI, a real Chromium run of
3435 proofs. It was reverted anyway, because *how* it got there is a cost this
repository does not want to pay again, and the record of why is worth more than
the code was. **The order of work is the deliverable here, not just the final
shape.** See [DESIGN.md §4, "Follow the example"](../../../DESIGN.md).

**Share the code, then keep the two in sync.** The order is: share; adjust
where the host genuinely requires it; document every difference that remains;
open an issue for each problem the port revealed; and solve each of those issues
for **both** runners at once. The last step is the one that matters and the one
under pressure to skip.

Differences are fine — a browser has no stdout, a terminal has no DOM, and the
two will use different APIs and wrappers around the same core. *Undocumented*
differences are not. The attempt shared the modules and then let the browser
keep its own test-name format, its own scheduling policy and its own clock, none
of which the host forced. That is the failure mode: it *looks* like success —
one module, one name — while two behaviours hide behind it, and two
implementations behind two names would have been more honest, because nothing
about the shared name signals the difference.

**`fjs t` is sequential, and that is a decision to copy, not a gap to fill.**
The attempt gave the browser a batch size — proofs launched in groups with a
yield between groups. Nobody had asked for it, no measurement motivated the
constant, and it was premature optimization in the strict sense: it made the
runner different from the example in order to solve a problem no one had
reported. Everything that followed was created by that choice. In order: the
batching had no paint boundary where it claimed one; the fix serialized the
groups and deadlocked a graph `fjs t` completes; the proof written for *that*
fix was flaky under load; its rewrite passed for the wrong reason and had to be
made first-opener-wins; the yield needed `MessageChannel` rather than
`setTimeout` only because `setTimeout` clamps to 4 ms once nested; and the
`MessageChannel` proof then failed under bun, which drains port messages before
running a due timer. Six rounds of review, every one of them downstream of a
constant that was finally deleted. The end state — no batch size at all — is
the state that copying `fjs t` would have produced on day one.

**A problem the browser reveals is not a browser problem.** Two came up, and
both are properly issues rather than fixes inside a port:

- Timing. `performance.now()` is coarsened and jittered in browsers, so a
  per-proof duration there is largely the clamp. But `sandbox` is the shared
  operation, so this is one decision for both hosts, not a browser-local
  workaround. See [Browser timer precision](timer-precision.md).
- Hostile values and cross-realm promises. The browser file today carries
  defenses `fjs t` has never had. Sharing the core means deciding what the rule
  *is*, once — not quietly keeping two. See
  [Hostile thrown values and cross-realm promises](hostile-proof-values.md) and
  [Imports, promises and realms](imports-promises-realms.md).

The rule that follows: **land the shared core with behaviour unchanged, then
take each new problem as its own change that lands in both runners together.**
An improvement the browser could have is an issue, not something to introduce
inside a port. A behaviour the port cannot preserve is a finding to record
before it merges, not a silent divergence to explain in review.

**Keep the change reviewable.** The attempt was 2646 insertions and 1408
deletions across 35 files in one PR — a move, a rewrite, a new effects layer, a
new host interpreter and a scheduling invention at once, which is why the
scheduling argument could not be separated from the sharing argument. Sequence
it: the shared semantics first, with `fjs t` unchanged in behaviour and the
browser file only calling into it; the layout moves after; anything genuinely
new last, on its own.

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
"website": "node ./fjs/module.mjs r ./fjs/website/module.f.mjs"
```

`fjs/website/module.f.mjs` must own proof discovery, manifest generation, and
HTML/entry generation as one `NodeProgram`. Do not invoke a non-FunctionalScript
preparation script such as `website/browser-prepare.mjs` directly from an npm
script. If preparation needs a Node capability that the FunctionalScript
program cannot currently express, add the smallest operation to
`fjs/effects/node/` and its real and virtual interpreters instead of bypassing
Effects. Existing `readdir`, `readFile`, and `writeFile` operations should be
reused where sufficient. This is the build rather than the runner, and it is a
reasonable second change rather than part of the first one — but it is part of
this issue, so it does not get dropped on the way.

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
- semantic progress events, independent of terminal text or DOM elements;
- **the test name.** `fjs t` prints
  `import("./a.proof.f.mjs").proof.x(): ok, 0.3 ms`, and the browser page must
  produce the same identifier for the same leaf. A shared core that leaves each
  host to format its own name has not finished sharing: a name is what makes two
  reports comparable, and a divergence there is the visible proof that the
  semantics underneath were never actually unified.

Keep host capabilities at the leaves. Candidate browser effects are module
import, monotonic time, event-loop yield, and report publication. DOM node
construction may instead remain in the small `module.mjs` adapter if making it
an effect adds an operation for every DOM detail without improving the shared
API. Add `fjs/effects/browser/` only after the required operation set is clear;
do not create a mirror of `effects/node` merely for directory symmetry.

A shared `all` that starts every child before awaiting any is worth stating as a
contract rather than leaving to each interpreter: a child may wait on something
a later sibling produces, so an interpreter that awaits one child before
starting the next hangs a graph the other host completes. Beyond that, **the
browser gets no scheduling policy of its own until someone reports a problem
with the one `fjs t` has.** If a page turns out to need a task boundary to
paint, that is a separate, measured change with its own issue — and the measure
is a boundary per unit of work, never a tuned count of proofs, because proofs
differ in cost by orders of magnitude.

An executor boundary will still be necessary because the console runner uses
the Effects sandbox while a browser catches synchronous throws and awaits
native promises. That boundary should answer one normalized leaf result. Tree
walking, throw inversion, aggregation, and reporting policy stay above it and
are shared.

### Constraints

- Preserve the recursive proof semantics and totals of `fjs t` exactly,
  including objects with a proof property named `then`; only actual promises
  are asynchronous values.
- Both runners must produce the same test name for the same leaf. This one is
  not a host difference: nothing about a browser prevents it, and a divergence
  here is the visible sign that the semantics underneath were never unified.
- Every remaining difference between the two runners is documented where it is
  made, and traceable to something the host forced. Host APIs and wrappers may
  differ freely; behaviour may differ only for a written reason.
- A fix for a problem either runner has lands in both, in the same change.
- Browser modules must not import Node built-ins, the Node effect interpreter,
  `node:test`, or Playwright.
- Website build-time filesystem access must be expressed by the FunctionalScript
  `NodeProgram` through Node effects; npm scripts must not run an impure helper
  as a second application entry point.
- The browser host runner must remain usable as native JavaScript with no
  bundling or transpilation.
- Pure `.f.mjs` additions require co-located proofs with complete line,
  function, and branch coverage.
- A proof must assert the property, not an engine's incidental scheduling. The
  suite runs under node, deno and bun, and they do not agree on the ordering of
  timers against other task sources — asserting one of those orderings makes a
  correct implementation fail somewhere.
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
- [ ] Share the test-name format, and prove both runners name the same leaf
      identically.
- [ ] Define normalized leaf, progress, infrastructure-error, totals, and report
      values without terminal or DOM fields.
- [ ] Decide whether browser import/time/yield/publication justify
      `fjs/effects/browser/`; document the decision before adding operations.
- [ ] Move static proof discovery and `_browser-suite.mjs` generation into
      `fjs/website/module.f.mjs`; extend `fjs/effects/node/` only for a concrete
      missing capability and prove the real and virtual interpretations.
- [ ] Delete `fjs/website/browser-prepare.mjs` and make the sole `website`
      command `node ./fjs/module.mjs r ./fjs/website/module.f.mjs` once the
      FunctionalScript generator owns the complete build; do not restore the
      removed `index-html` alias.
- [ ] Add `emergent_testing/browser/module.f.mjs` for pure browser application
      composition and its complete proof.
- [ ] Move the current browser host code to
      `emergent_testing/browser/module.mjs` and reduce it to capability
      interpretation, DOM rendering, and browser publication.
- [ ] Update the generated website entry and browser-test application imports
      to the new module paths.
- [ ] Prove both runners produce equivalent paths, throw outcomes, recursive
      test counts, and normalized failures from the same fixtures.
- [ ] Record every behaviour the browser file has today and the shared core will
      not keep, as an issue, before the sharing change merges.
- [ ] Close each of those issues for both runners at once, so the two stay in
      sync rather than drifting from the day the core is shared.

### Related

- [Browser testing](browser-testing.md) — browser-native application and runner
  requirements.
- [Test-runner behavior](661-test-runner-behavior.md) — documented differences
  that must remain intentional after sharing the core.
- [Test tree walker](65z-tf-test-tree-walker.md) — earlier work around recursive
  proof-tree traversal.
- [Hostile thrown values and cross-realm promises](hostile-proof-values.md) —
  a behaviour the browser has and `fjs t` does not; decide it, do not inherit
  two answers.
- [Imports, promises and realms](imports-promises-realms.md) — the same, for the
  loading and promise-detection machinery.
- [Browser timer precision](timer-precision.md) — `sandbox` is shared, so its
  measurement is one decision for both hosts.
- [Report a test's name before running it](report-before-running.md) —
  reporting is the next thing worth sharing after the semantics.
