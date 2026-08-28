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
constant that was finally deleted.

**And "no batch size" is not "no yielding" — this file said so badly enough to
mislead a later reader, which was me.** Copying `fjs t` exactly *does* freeze a
page: without a yield the whole suite runs as one task, measured at 54.7 s on
this repo's own browser suite, and the line above about the batching having no
paint boundary is about a bug in that attempt rather than a finding that the
yield did nothing. What the browser needs is a turn, on a budget it can defend
— a frame — and what it never needed was a number of proofs. Step 5's task list
records where that landed and what it measured.

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

- [ ] **4. Common effects.** Move `all`, `sandbox` and `catch` out of
      `effects/node` into a shared module that `effects/node` re-exports
      unchanged, so nothing has to move with them.

      **The list is now settled, by measurement rather than by argument.**
      Step 5's interpreter implements exactly those three, so exactly those
      three have a second implementer. `await` does not: it belongs to the
      *registration* path that external frameworks drive, which no browser
      runs. `import` does not: a page loads modules through its own importer.
      `now` does not: a browser run measures its own wall clock rather than
      dispatching an operation for it. `fetch` does not: nothing in the shared
      runner performs one. Those four stay in `effects/node` until something
      gives them a second implementer, which is the same rule that let this
      list shrink rather than a different one applied to them.
      [node-module-layering](../../effects/todo/node-module-layering.md)
      carries the same answer.

      **The expectation this step was written with was wrong, which is why the
      list was measured rather than argued.** `all`, `await` and `sandbox` were
      agreed all along. `Now`, `Fetch` and `Import` were not: this step listed
      all three as moving, on the reasoning that a browser proof run needs a
      clock and dynamic import. That is true of the *page* and false of the
      *effect set* — the page reads its own clock and calls its own importer,
      in the impure shell where host values belong, and neither reaches the
      interpreter as an operation. Reasoning from what a host *can* do
      predicted one answer; reading what the interpreter had to implement gave
      another.

      **The vocabulary went first, and it was not speculative.** Before an
      operation can move, the types it is *declared in* have to have a home:
      `OpResult`, `IoError`, `IoErrorInfo`, `IoChannel`, `IoResult` and the
      `ioError`/`toIoError` constructors were all in `effects/node`, and none
      of them names a host — "the runner cannot dispatch" and "the host tried
      and failed" are how *any* operation goes wrong. That misfiling already
      had a victim: `effects/memory/types.ts`, which has no host at all,
      imported `OpResult` from `../node/types.ts`. So that move is separation
      of concerns with a consumer today
      ([DESIGN.md §4](../../../DESIGN.md)), not an extraction on the promise of
      one — which is the test the operations themselves have yet to pass, and
      why they wait for step 5. `effects/node` re-exports every moved name, so
      the several dozen modules that reach for them through it are untouched.

      **`isNotFound` stayed, and it is the boundary marker for this step.** It
      reads `ENOENT`, a POSIX filesystem code a browser never reports, so it is
      a node predicate however much it looks like the constructors beside it.
      Being about a *host failure* does not make a thing host-agnostic; being
      about no host in particular does. Apply that test to each operation below
      rather than moving the list wholesale —
      [node-module-layering](../../effects/todo/node-module-layering.md) is
      where those rulings live, and it already declines to move `Now` and
      `RandomInt` for a related reason.
      **The `catch` operation landed first, because step 7 cannot be written
      without it.** The shared walk enumerates what a leaf returned, which runs
      user code; the browser catches that today and the shared walk did not, so
      sharing the traversal would have *lost* a behaviour. `sandbox` could not
      hold the guard — the virtual runner's is a fixture pass-through — so
      [hostile proof values](hostile-proof-values.md) named a second operation
      and this took it. `fjs t` gained the behaviour in the process, which is
      what made that change worth landing on its own rather than inside the port.

- [x] **5. A browser interpreter** for exactly those operations, with no
      scheduling policy of its own. `fjs/effects/browser/module.mjs`:
      `sandbox`, `catch`, `all`, plus whatever operations the application adds
      — for the page, one `report`. `sandbox` is `effects/node`'s, copied
      rather than redesigned, because two runners that disagreed about an
      awaited leaf would not be one runner.
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
- [x] **7. One skeleton.** The page's proof-tree walk is deleted and the shared
      traversal runs it. `browser.mjs` no longer discovers leaves, applies the
      throw expectation, walks return values or counts anything: it supplies a
      `Reporter` and an interpreter, and the traversal does the rest.

      **The batching went with it**, as this file said it should be decided
      rather than inherited: `batchSize = 25` is gone. Nothing asked for it, no
      measurement motivated the constant, and it was the origin of six rounds of
      review in the reverted attempt. Deleting the *yield* along with it was the
      overshoot — a page that never gives the thread back cannot paint or answer
      a click — so the browser interpreter gives it back on a frame budget
      instead, which is a number about the host rather than about proofs. The
      traversal still schedules nothing, so `fjs t` is unchanged.

      **What the skeleton had to grow**, rather than what the browser had to
      keep: the traversal now threads a `RunOutcome<R>` — the folded totals
      plus each host's own leaf records, in the walk's order. The browser needs
      its report's `results` ordered by structure, and taking them in
      completion order would have pinned the scheduler's behaviour instead of
      the suite's. `fjs t` answers `void` there and collects nothing, which is
      the extension point doing its job.

      **What stayed the page's own, with the reason:** reading a *module's*
      exported tree. The shared walk guards a returned tree through `catch`
      (see [hostile proof values](hostile-proof-values.md)) but deliberately
      not the exported one, because there is no leaf to attribute that failure
      to. `fjs t` panics; the page catches it and reports one failed module.
      That asymmetry predates this step and survives it.

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

Note also that `testResult` and `addResult` now sit inside `fjs t`'s own
reporting path: since step 6 the result lines, the summary counts and the exit
code all read them, so a defect there can mislabel or miscount the very
failures it causes — and **`fjs t` alone cannot see that**. The direct proofs
that pin both functions are themselves reported through the functions they
test: mutate `testResult` to answer `passed` for everything and the proof that
asserts `failed` does fail, but its failure is relabelled `ok` on the way out —
measured, the mutated suite prints 3480 pass, exit 0. Mutate the fold to never
count a failure and the gate (`failed !== 0`) reads the fold it is gating —
exit 0 again, with the total quietly short. That is not a duplicate-decision
problem to fix with a second count (the second count is what step 6 removed);
it is a runner auditing itself, which no arrangement of its own proofs escapes.
What actually holds the line is the *other* execution path: `all.test.mjs`
registers every proof with an external framework (`register`, which consults
neither `testResult` nor `addResult` — a deliberate independence, worth
keeping), and CI runs it under node, bun and deno. Both mutants above fail
there — 16 and 18 failures, exit 1. So a reporter defect shows up as `fjs t`
disagreeing with the external runners, never as every gate lying together —
and `fjs t`'s own exit code is trustworthy only in that company.

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

- [x] Inventory duplicated semantics in `emergent_testing/module.f.mjs` and
      `emergent_testing/browser.mjs`, and define the smallest shared API. The
      shared API is `Reporter<O, R>` and the `RunOutcome<R>` the traversal
      answers with; the page supplies the parts and nothing else.
- [x] Name the skeleton's parts explicitly — execute a leaf, report a result,
      link a module — and check that nothing host-specific is left outside one
      of them. `test`, `result` and `summary` are the parts; linking a module
      stays outside the skeleton, which is why `runEntries` exists beside
      `runModuleMap`.
- [x] Make the existing `collectTests`/path behavior the single source of truth
      for console and browser execution. The page's own walk is deleted; it
      calls `collectTests` once, under its own guard, and hands the leaves to
      `runEntries`.
- [x] Share the test-name format, and prove both runners name the same leaf
      identically. The browser report carries a `name` built by `fmtImport`, and
      `nameMatchesTheConsoleRunner` pins it to that function rather than to a
      spelling. Its `path` field is now redundant with `name` for every leaf and
      should go when the report shape is decided.
- [x] Define a normalized leaf value without terminal or DOM fields:
      `TestResult`, built by `testResult`, carrying identity, status and
      duration. Progress, infrastructure-error, totals and report values are
      still each host's own.
- [x] Decide whether browser import/time/yield/publication justify
      `fjs/effects/browser/`; document the decision before adding operations.
      They do not: the interpreter implements `sandbox`, `catch` and `all` and
      nothing else — import, time and publication are the page's, in its
      impure shell. Recorded in that module and in
      `effects/todo/node-module-layering.md`.
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
- [x] Prove both runners produce equivalent paths, throw outcomes, recursive
      test counts, and normalized failures from the same fixtures. They now
      share the code that decides all four, and `nameMatchesTheConsoleRunner`,
      `expectedThrowStatusMatchesTheSharedOne` and
      `normalizedResultMatchesTheSharedOne` assert against the console
      runner's own functions rather than against a spelling.
- [x] Record every behaviour the browser file has today and the shared core will
      not keep, as an issue, before the sharing change merges. Two: the
      `batchSize = 25` yielding — whose *constant* was the mistake and whose
      *yielding* was load-bearing, see below — and the unguarded read of a
      module's *exported* tree, which stays the page's own and is tracked by
      [hostile-proof-values](./hostile-proof-values.md).
- [ ] Close each of those issues for both runners at once, so the two stay in
      sync rather than drifting from the day the core is shared.
- [x] Decide where a browser run gives the thread back. **The browser
      interpreter's `sandbox`, on a frame budget** — 8 ms, what a 60 Hz frame
      leaves for script — not a count of proofs, and not the traversal, which
      stays free of scheduling so `fjs t` is untouched.

      This was got wrong twice before it was measured, and both errors are
      worth keeping. First, deleting `batchSize = 25` was read as deleting the
      whole idea: the constant was indefensible — twenty-five trivial leaves
      are nothing and twenty-five heavy ones are still a freeze — but the
      `setTimeout` between waves was the only thing giving the page a turn.
      Without it the whole suite is one task: leaves resolve through
      microtasks, and a microtask drain never returns to the event loop, so
      nothing paints and no click is answered until the run ends. Measured in
      Chromium on this repo's own browser suite: a single **54.7 s** task, zero
      rows painted, and the browser offering to kill the page.

      Second, the fix's first shape awaited the budget *before* each leaf, and
      changed nothing. A leaf runs synchronously inside its handler, which is
      what makes `all`'s children start one after another as each previous leaf
      finishes; await anything first — even a resolved promise — and every
      handler asks whether the slice is spent at the same instant, before any
      leaf has run. All see room, none yields. The check has to answer without
      awaiting when there is room, which is why it answers `null` rather than a
      settled promise.

      After: longest task **98 ms** on the first run and **no task over 50 ms**
      on the second, 3456 rows painted, wall clock 52.2 s against 52.8 s — the
      yields cost 0.38 ms each and the budget asks for few of them. `all` was
      not the place to put this: it must start every child before awaiting any,
      so pausing between children hangs a graph whose child waits on a later
      sibling, which is the deadlock the reverted attempt hit.
- [ ] Prove `runBrowserProofs`'s `infrastructure-error` branch — the run's own
      failure, as opposed to any proof's. It is the one branch of the page with
      no proof, and reaching either half of it (an operation reporting through
      the error channel, or one the interpreter cannot dispatch at all, which
      rejects) needs an effect the public entry point gives no way to inject.
      `effects/browser/proof.mjs` pins the interpreter's half — a command no
      handler claims rejects — so what is left is the page's own guard.

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
