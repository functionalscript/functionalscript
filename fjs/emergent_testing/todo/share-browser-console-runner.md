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

**One skeleton, with named parts.** The thing to share is the *runner itself*:
the order in which modules are linked, leaves discovered, bodies executed,
throws inverted, results counted and the run concluded. Both hosts run that same
skeleton. Everything host-specific is a **part** the skeleton calls at a place it
names — where the leaf body is executed, where a result is reported, where a
module is linked — and a part is where a browser is allowed to be a browser.

That gives exactly two ways to accommodate a host, both additive: change *that
host's part*, or *improve the skeleton so every host benefits*. There is no
third. A branch inside the skeleton asking which host it is running on is a fork
wearing a shared name. A host need that no existing part can express means the
skeleton is missing an extension point — add the point, which every host then
supplies, rather than a special case.

Differences between the parts are fine and expected: a DOM row and a terminal
line are two implementations of the same named part, and the skeleton above them
cannot tell which it has. *Undocumented* differences are not. The attempt shared
the modules and then let the browser keep its own test-name format, its own
scheduling policy and its own clock — none of which its host forced, and none of
which belonged in a part. That is the failure mode: it *looks* like success —
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

The rule that follows: **land the shared skeleton with behaviour unchanged, then
take each new problem as its own change — in the skeleton where it belongs
there, so both runners get it, or in every part at once.** An improvement the
browser could have is an issue, not something to introduce inside a port. A
behaviour the port cannot preserve is a finding to record before it merges, not
a silent divergence to explain in review.

**Keep the change reviewable.** The attempt was 2646 insertions and 1408
deletions across 35 files in one PR — a move, a rewrite, a new effects layer, a
new host interpreter and a scheduling invention at once, which is why the
scheduling argument could not be separated from the sharing argument. Sequence
it: the shared semantics first, with `fjs t` unchanged in behaviour and the
browser file only calling into it; the layout moves after; anything genuinely
new last, on its own.

### Steps

**One step per pull request.** The reverted attempt did the whole issue at once
— 2646 insertions and 1408 deletions across 35 files — and that is why its
arguments could not be separated: a question about scheduling became a question
about the port. Each step below stands on its own, leaves both runners working,
and is reviewable without the next one.

- [x] **1. One name function.** The page names a leaf with `fmtImport`, the
      function `fjs t` prints its result lines with, so the two runners spell a
      test identically. This is the smallest possible piece of the issue and
      also its most visible symptom.
- [x] **2. One normalized result.** `TestResult` and `testResult` in the shared
      module: a leaf's identity, status and duration, decided once. The throw
      expectation is applied through the same `invert` both runners now use, so
      "did this leaf pass" has one answer. Describing a *thrown value* stayed
      with each host, deliberately — see below.
- [x] **3. One `sandbox`.** Done, and it turned out to be a deletion. The
      `Symbol.species` machinery — `subscribe`, `speciesFails`, `runPromise` and
      `species.proof.mjs` — was exercised only by fixtures that are themselves
      `.mjs` and so never run in a browser, and `await` handles every case it
      covered that a same-realm promise can present. Replaced
      by `instanceof Promise`, which is what `fjs t` does. The measurements are
      in [imports, promises and realms](imports-promises-realms.md); the scope
      rule they rest on is in [browser testing](browser-testing.md).

- [ ] **4. Common effects.** Move the host-independent operations (`all`,
      `await`, `fetch`, `import`, `now`, `sandbox`) out of `effects/node` into a
      shared module that `effects/node` re-exports unchanged, so nothing has to
      move with them.
- [ ] **5. A browser interpreter** for exactly those operations, with no
      scheduling policy of its own.
- [x] **6. One reporter.** The event stream — a leaf landed, a run ended —
      that both hosts subscribe to. Step 2 gave them the *value*; this gave
      them the seam it travels through. `Reporter.result` now receives the
      shared `TestResult` built by the runner instead of raw material every
      reporter normalized for itself, and the run-ended event is `RunTotals`,
      folded from the leaf results by one `addResult` — the summary line, the
      exit code and the browser report's counts and pass/fail status all read
      that same fold. This is what
      [report a test's name before running it](report-before-running.md)
      needed before a start event could exist: adding one is now a third event
      kind on an existing stream. What stayed each host's own, deliberately:
      the raw `SandboxResult` still travels next to the `TestResult`, because
      describing a *thrown value* is each host's part (step 2's finding); and
      the browser report's own `duration` stays wall-clock rather than the
      fold's summed durations, because its leaves run concurrently and the sum
      only means "how long the run took" for a sequential runner —
      `RunTotals` documents that.
- [ ] **7. One skeleton.** The page's proof-tree walk is deleted and the shared
      traversal runs it.
- [ ] **8. The layout move**, and the website preparation program.

Steps 3 and 7 are the ones that change behaviour, so they are the ones to keep
smallest. Step 3 changed less than expected: with the scope written down, it was
a removal. Anything a step reveals goes to an issue and is fixed for both runners
later, never inside the step.

**What step 2 revealed, recorded rather than fixed.** With the status shared,
two differences in *describing* a failure are now visible, and both are left
alone on purpose:

- `fjs t` reports a thrown value by printing it (`String(v)`) and keeps no
  stack; the browser reads `message` and `stack` off it, because its report has
  to survive a wire hop. Both need the raw value, and a serializable record
  cannot carry one — so the description is each host's part, and `TestResult`
  says so where a reader will look.
- For a proof marked `throw` that returns cleanly, `fjs t` reports the returned
  *value* as the error while the browser reports the fixed string
  `Expected the proof to throw`. The two agree on the status, which is what
  step 2 shares; they disagree on the message, which belongs with the point
  above.

Note also that `testResult` now sits inside `fjs t`'s own reporting path, so a
defect in it can mislabel the very failures it causes — a mutation forcing every
status to `passed` prints `ok` on failing lines. Since step 6, the pass/fail
counts and the exit code read the same shared status (the walk folds each
leaf's `TestResult` with `addResult`), so such a defect no longer leaves an
honest summary behind either — that duplicate decision was exactly the drift
this issue exists to remove, and what holds the line now is that `testResult`
and `addResult` are pinned by direct proofs rather than by a second
implementation agreeing. Worth remembering when reading output while changing
either function.

### Why the remaining steps are worth taking

Steps 4 through 7 look like tidying — move some operations, add an interpreter,
share a reporter, delete a traversal. They are not. They draw a boundary the
browser runner does not have, and the promise episode is what its absence costs.

`browser.mjs` is impure `.mjs`, so a live host promise and a proof tree travel
the same code path, and the code has to ask *which of these is a promise?* That
is an identity-by-origin question — `instanceof` asks which copy of the
constructor made the value, not what the value is — and asking it in a place
that handles business logic is what produced ~150 lines of `Symbol.species`
machinery, several rounds of review, two measured ways to hang the suite, and a
reversal. The answer, in the end, was that the question should not have been
there: the runner executes authored FunctionalScript, which by convention has
no promises — a convention nothing enforces, which is itself part of the
problem.

`fjs t` mostly escapes this already, and not by being more careful. `sandbox` is
an *operation*: the promise is awaited inside the interpreter and the pure core
receives a `SandboxResult`. The host value never reaches the logic. That is the
same discipline `fjs/effects` applies to a live HTTP server, which pure code
holds as `Nominal<'server', '160855c4…', unknown>` — a handle whose identity is
a content hash, with the real object kept by the interpreter.

The repository rule now says this outright — business logic in `.f.mjs`, plain
`.mjs` only as a thin host boundary — and by that measure `browser.mjs` is
migration debt: roughly 200 of its 405 lines are logic wearing one host touch.
That is recorded in
[move the browser runner's business logic to FunctionalScript](browser-runner-functional-script.md),
which is the same work seen from the purity side rather than the sharing side.

So the remaining steps are that boundary, applied to the browser:

- **step 4** puts the host-independent operations somewhere both hosts can name;
- **step 5** gives the browser an interpreter, which is where its host values
  belong;
- **steps 6 and 7** move reporting and traversal into the pure core, which is
  where host values must never be.

When they are done, `instanceof Promise` lives in exactly one interpreter, as
glue, and no shared code asks the question. The three lines in `browser.mjs`
today are in the right *place* only because the boundary has not been drawn
there yet — they are temporary in a way the rest of the shared core is not.
See [`todo/plan/capl.md`](../../../todo/plan/capl.md), which argues the general
form: logic pure, serializable and content-addressed; host values behind
handles.

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
  Note that a name embeds a *module key*, and a module key is relative to the
  root a run was given: `fjs t` invoked in `fjs/types/list` names a leaf
  `import("./proof.f.mjs")...` where the same leaf from the repository root is
  `import("./fjs/types/list/proof.f.mjs")...`. That is `fjs t` differing from
  itself across roots, not the two runners differing, and it is deliberate — a
  subtree run reports a subtree. But two reports are only comparable when their
  roots agree, and once the browser suite is a gate the question of which root a
  report declares is worth settling. It belongs to the report shape, with
  `path`.
- The report shape now has three open questions, and they want settling
  together rather than one at a time: whether `path` survives now that `name`
  exists; whether a report declares the root its module keys are relative to;
  and whether a module-level failure — one that will not link, which the browser
  reports as a `TestResult` named by its source so its totals cannot read as
  "no tests" — belongs in a variant of its own instead. Each is small alone;
  answering one without the others is how a report shape ends up carrying three
  half-decisions.
- The skeleton never asks which host it is running on. Anything host-specific is
  a part it calls; anything it cannot express through a part is a missing
  extension point, not a special case.
- Every remaining difference between the two runners lives in a part, is
  documented there, and is traceable to something the host forced. Host APIs and
  wrappers may differ freely; behaviour may differ only for a written reason.
- A fix for a problem either runner has lands in the skeleton, or in every part
  at once — in the same change.
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
- [ ] Name the skeleton's parts explicitly — execute a leaf, report a result,
      link a module — and check that nothing host-specific is left outside one
      of them.
- [ ] Make the existing `collectTests`/path behavior the single source of truth
      for console and browser execution.
- [x] Share the test-name format, and prove both runners name the same leaf
      identically. The browser report carries a `name` built by `fmtImport`, and
      `nameMatchesTheConsoleRunner` pins it to that function rather than to a
      spelling. Its `path` field is now redundant with `name` for every leaf and
      should go when the report shape is decided.
- [x] Define a normalized leaf value without terminal or DOM fields:
      `TestResult`, built by `testResult`, carrying identity, status and
      duration. Progress, infrastructure-error, totals and report values are
      still each host's own.
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
