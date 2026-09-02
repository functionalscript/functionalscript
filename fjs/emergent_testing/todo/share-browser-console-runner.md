## Share the browser and console proof runners

**Priority:** P3
**Status:** open — every step has landed and both runner-failure routes are
proved. One proof is left: that the two runners answer identically from the
same fixtures.

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

A first attempt at this issue was written, reviewed, approved and then
reverted (a second, #1759, followed and is recorded in its own section below).
It
worked: one shared `runModuleMap`, a `Reporter` per host, an `effects/common`
layer, a browser interpreter, 100% coverage, green CI, a real Chromium run of
3435 proofs. It was reverted anyway, because *how* it got there is a cost this
repository does not want to pay again, and the record of why is worth more than
the code was. **The order of work is the deliverable here, not just the final
shape.** See [DESIGN.md §4, "Follow the example"](../../../DESIGN.md).

**One skeleton, with named parts.** The thing to share is the *runner itself*:
the order in which leaves are discovered, bodies executed, throws inverted,
results counted and the run concluded. Both hosts run that same skeleton.
Everything host-specific is a **part** the skeleton calls at a place it names —
where the leaf body is executed, where a result is reported — and a part is
where a browser is allowed to be a browser. This paragraph originally listed
"where a module is linked" among the parts, and building it settled the
boundary the other way: **linking happens before the skeleton, and the
skeleton accepts linked modules** — `fjs t` loads through its module map, the
page through the `import` operation, and neither shape fits a part the other
host could supply. (The "in host code, through its own importer" this
paragraph used to say was a mis-measurement, corrected below and in
functionalscript#1818: a callback is an operation nobody has named, and the
page dispatches `import` like any other host now.) The tasks below record the
consequence: the runner exposes an entry point for a host that enumerates its
own modules, and enumerating a module's export is that host's own guarded
read.

That gives exactly two ways to accommodate a host, both additive: change *that
host's part*, or *improve the skeleton so every host benefits*. There is no
third. A branch inside the skeleton asking which host it is running on is a fork
wearing a shared name. A host need that no existing part can express means the
skeleton is missing an extension point — add the point, which every host then
supplies, rather than a special case.

Differences between the parts are fine and expected: a DOM row and a terminal
line are two implementations of the same named part, and the skeleton above them
cannot tell which it has. *Undocumented* differences are not. The first attempt shared
the modules and then let the browser keep its own test-name format, its own
scheduling policy and its own clock — none of which its host forced, and none of
which belonged in a part. That is the failure mode: it *looks* like success —
one module, one name — while two behaviours hide behind it, and two
implementations behind two names would have been more honest, because nothing
about the shared name signals the difference.

**`fjs t` was sequential when that attempt forked from it, and that was a
decision to copy, not a gap to fill.** (It then fanned out through `all` for
a while; step 7a returned it to this paragraph's state, which is the state
everything here argues for.) The first attempt gave the browser a batch
size — proofs launched in groups with a
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
mislead a later reader, which was me.** Copying the *concurrent* `fjs t` that
step 7a replaced would freeze a page: without a yield the whole suite runs as one
task, measured at 54.7 s on this repo's own browser suite, and the line above
about the batching having no paint boundary is about a bug in that attempt
rather than a finding that the yield did nothing. What the browser needs is a
turn per unit of work, and what it never needed was a number of proofs. The
second attempt's record below carries where that ended: with a *sequential*
run, the turn is one macrotask per report, in the page's own handler.

**A problem the browser reveals is not a browser problem.** Two came up, and
both are properly issues rather than fixes inside a port:

- Timing. `performance.now()` is coarsened and jittered in browsers, so a
  per-proof duration there is largely the clamp. But `sandbox` is the shared
  operation, so this is one decision for both hosts, not a browser-local
  workaround. See [Browser timer precision](timer-precision.md).
- Hostile values and cross-realm promises. The browser file today carries
  defenses `fjs t` has never had. Sharing the core means deciding what the rule
  *is*, once — not quietly keeping two. See `Catch` in
  [`fjs/effects/common/types.ts`](../../effects/common/types.ts) and
  [Imports, promises and realms](imports-promises-realms.md).

The rule that follows: **a port changes only the behaviour its own argument
requires, named and proved — everything else lands as its own change, in the
skeleton where it belongs there, so both runners get it, or in every part at
once.** An improvement the browser could have is an issue, not something to
introduce inside a port. A behaviour the port cannot preserve is a finding to
record before it merges, not a silent divergence to explain in review. (An
earlier version of this rule said "with behaviour unchanged" — right against
smuggled improvements, but stated too strongly once the plan itself became a
scheduling change the port necessarily brings to the page; the next paragraph
names what step 7b changes and why.)

**Keep the change reviewable: one argument per PR.** The first attempt was
2646 insertions and 1408 deletions across 35 files in one PR — a move, a
rewrite, a new effects layer, a new host interpreter and a scheduling
invention at once, which is why the scheduling argument could not be separated
from the sharing argument. The sequence that keeps them separate is the one
the plan below orders: the scheduling change first, alone, in the console
runner where it is observable and provable without any port (step 7a); then
the port (step 7b) — which is itself a behaviour change for the *page*, three
times over, because 7a touches only `module.f.mjs` and the page does not run
that code until the port: the page's scheduling goes from 25-at-a-time
concurrent batches to sequential, its live progress goes from
children-before-parent to the structural order, and `runModuleMap`'s answer
changes shape. One argument per PR still holds — 7b's argument is the port,
and its behaviour changes are the browser's side of decisions 7a and this
plan already made and named, each carried in 7b's changelog and proofs rather
than discovered in review; the layout moves after. An earlier version of this paragraph said "shared
semantics first, with `fjs t` unchanged in behaviour" — right about
separation, wrong about order once the plan itself became a scheduling change:
porting first would have moved the browser onto semantics about to change
under it.

### The second attempt (#1759), and the plan it simplified to

A second attempt was also written, reviewed — twenty-one review threads, two
independent approvals — and reverted with every gate green: `tsc`, 3,547
proofs, 100% coverage, a real Chromium run. It shared the traversal exactly as
the steps below asked: one `runModuleMap`, a `Reporter<O, R>` answering each
host's own leaf record, a browser interpreter for `sandbox`, `catch` and
`all`. The owner reverted it for a reason the first attempt's record already
contains but did not say loudly enough: **the concurrency was the complexity.**
Every hard problem the review fought traces to the traversal fanning out with
`all`, and the machinery each fix added — a frame budget, a guessed 8 ms
constant, `scheduler.yield`/`MessageChannel` selection — is infrastructure a
test runner shouldn't need. The requirement, stated by the owner: a simple,
sequential run, no optimization, a clear message after each test, exactly as
the CLI works. Speed is explicitly not a goal.

#### The plan: sequential

Run one leaf's **whole chain** — test, report, children — to completion before
the next leaf starts. That is the entire design. Its consequences:

- **The reporting burst is impossible by construction.** Each leaf's report is
  awaited before the next leaf runs; the interleaving is the control flow, not
  a property to enforce or prove around.
- **The page yields in its own `report` handler**: append the row, await one
  macrotask, answer. That is the browser's spelling of what the CLI's `write`
  already is — print the line, let the terminal show it, run the next test. It
  is page code in the impure shell, so no scheduling policy touches shared
  code, and there is no constant to guess. (`setTimeout(0)`'s nested 4 ms
  clamp costs ~4 ms per test; speed is not a goal, and bun never runs page
  code, so the clamp forces nothing.)
- **No frame budget, no yield primitive selection, no batch size.** The longest
  blocking task is the longest single proof, with zero tuning.
- **The traversal never fans out**, so the variadic-`all` argument ceiling
  ([all-argument-limit](../../effects/todo/all-argument-limit.md)) leaves the
  traversal entirely, and the browser interpreter needs only `sandbox`,
  `catch`, `import` and its own `report` — nothing that schedules.
- **`fjs t`'s output becomes honest**: lines print after each test in
  structural order, and per-leaf durations stop being inflated by concurrent
  wall time — today a browser-suite leaf reports ~20 s because ~130 others
  share its clock.
- **The cost**: wall clock becomes the sum of awaits instead of the max, and a
  proof that secretly depends on a sibling running concurrently deadlocks.
  Both are accepted; the second is a timing dependency being flushed out.
  `all` and `both` remain as *operations* for programs that want concurrency —
  only the traversal stops using them.

Sequence it as two PRs: **first the sequential traversal in `module.f.mjs`
alone** — console-observable, `fjs t` prints each line as its test finishes,
the full suite run under it is what finds any concurrency-dependent proof, and
the scheduling change is breaking and gets its own changelog entry — **then the
browser port**, which invents no scheduling of its own: the sequential order
arrives with the shared traversal the page now calls (a page-behaviour change,
named as such in step 7b and the reviewability paragraph above), the page's
`report` handler yields one macrotask as page code, and the browser
interpreter contains no scheduling at all. This order — the idea first, in the
context that can prove it, then a port that carries no idea of its own — is
the sequencing [DESIGN.md](../../../DESIGN.md) describes for a change that is
the plan's premise rather than the port's discovery.

#### The pitfall catalog

Every problem the second attempt met, its cause, and the solution that worked.
The first group is dissolved by the sequential plan; the second group applies
to **any** implementation and the next implementer must not rediscover them;
the third is about method.

**Dissolved by sequential:**

1. **The single-task freeze.** Leaves resolve through microtasks, and a
   microtask drain never returns to the event loop, so the whole suite ran as
   one task — measured in Chromium: **54.7 s**, zero paints, the browser
   offering to kill the page. #1759's fix was a frame budget in the
   interpreter, which worked (longest task 97–104 ms) and is exactly the
   machinery the sequential plan deletes: one macrotask per report gives a
   task per test with no budget at all.
2. **The reporting burst.** Under `all`, every child starts before any is
   awaited, so each leaf's `report` — a *continuation*, a microtask — queues
   behind the entire suite's execution. Measured: first row in the DOM at
   **44.3 s of a 50 s run**, 90% of 3,461 rows within ~30 ms of each other.
   No budget can fix this — the ordering is the traversal's, and disabling the
   budget left the burst unchanged. `fjs t` has it by construction too.
3. **The variadic `all` ceiling.** Every fan-out is a spread, a spread is a
   call, and a call has an argument limit: 50,000 siblings build, 100,000
   throw `RangeError` **while building the effect**, before any interpreter
   can catch it. Sequential removes every traversal site;
   [all-argument-limit](../../effects/todo/all-argument-limit.md) keeps the
   rest.
4. **`batchSize = 25` was doing two unnamed jobs**: its `setTimeout` between
   waves was the page's only macrotask boundary, and awaiting each batch
   bounded how far reporting lagged execution. Nobody chose it for either. (A
   third was claimed during review — staying under the argument ceiling — and
   was a misattribution: `Promise.all(batch.map(…))` passes one iterable, so
   the old runner had no spread at any batch size; the ceiling is item 3's,
   the variadic operation's.) The lesson is not that the constant was right —
   it was indefensible — but that **before deleting unmotivated code,
   enumerate what it does, not what it was for.**

**These survive into any implementation:**

5. **Enumerating is user code; read once.** A getter runs on every read. A
   preflight `collectTests` that only *checked* the tree ran every getter a
   second time, and one that succeeded then threw escaped as a synchronous
   throw — page stuck in `running`, no report, no completion event. The same
   bug recurred one layer down in the same PR: a collision check enumerated
   the interpreter's `extra` map and the construction enumerated it again, so
   a proxy could hide a key from the check and reveal it to the build. The
   rule both times: **read a user value once, and derive everything from that
   one reading.**
6. **The page's modules are a list, not a map.** Routing them through a
   record-shaped `ModuleMap` let `Object.fromEntries` keep only the last of
   two same-labelled modules and report it twice. Two entries with one label
   are two runs, in the order passed.
7. **A run must not start before its promise is published.** A leaf executes
   synchronously inside its handler, so without a deferral the first proofs
   run while `runBrowserProofs` is still building what it returns — a proof
   reading `fjsBrowserTestReport` sees the previous run's promise. Defer
   everything that runs user code (enumeration included) behind one
   `Promise.resolve().then(...)`.
8. **Both ways a run fails as a runner must end in a report.** The error
   channel carries what an operation reported; a *rejection* carries what the
   interpreter could not dispatch at all, and an unhandled one is a page stuck
   in `running` forever. Handle both into the `infrastructure-error` report.
9. **Joins must be linear, and sequential does not grant that for free.**
   Pairwise immutable concatenation was Θ(N²) twice — across siblings, then
   again down a parent/child chain, where "flatten once at the end" recopies
   each subtree once per ancestor and is the same Θ(N²) moved. The fix that
   worked was a rope: joining is one node naming both sides, `toArray` walks
   it once where the run ends. A sequential fold changes execution order, not
   concatenation cost — an immutable `[...acc, r]` append copies the prefix
   every iteration and is the same Θ(N²) — so the port keeps the rope, or
   another accumulator that is demonstrably linear. The rule has since caught
   a third case that had nothing to do with the walk's shape:
   functionalscript#1790 collects each failing leaf so the run can describe
   them all at the end, and that list is threaded through every leaf and joined
   at every module boundary like the totals are. It is a `List` joined with
   `concat` for that reason. Anything a run *accumulates* is subject to this,
   not only the results it walks.
10. **A new exported boundary that its own consumers cast past is not typed.**
    `browserRun` began as `(effect: unknown) => Promise<unknown>` with `any`
    casts at both call sites, and its `extra` was `Partial` — advertising a
    recovery the dispatcher does not perform (it panics on an unclaimed
    command, by design). Make it generic over the effect and its `Result`,
    take a complete map, panic on a handler that claims a core operation
    (silently letting either side win makes the type or the caller a liar),
    and carry handlers by property *descriptor* — `match` looks handlers up
    with `getOwnPropertyDescriptor`, so a spread-merge silently drops a
    non-enumerable handler the layer's dispatch would have accepted.

**Method:**

11. **A proof that observes a coincidence is worse than no proof, because it
    is counted as cover.** A proof that the budget yielded watched for *a*
    macrotask turn during a run; under the full suite a neighbouring proof
    supplies one anyway, so it stayed green with the defect present — sound in
    isolation, inert where the project runs it. Assert by *ordering* (a
    macrotask cannot run until every pending microtask has) or by structure,
    never by observing that the loop turned. And mutation-check under the full
    `npm test`, which is the only run that counts — the inert proof passed its
    own isolated mutation check.
12. **Measure what the user sees, not a proxy for it.** "392 frames served and
    194 progress updates" was reported as "rows painting as they land"; the
    frames were real and dominated by the loading phase, and row count over
    time — the thing a person watches — was never sampled. It read 0 until the
    end. Sample the artifact itself.
13. **When a decision changes, grep the markdown for the old one.** Seven
    review findings on one branch were the same shape: the new answer written
    down with the superseded instruction left standing beside it, handing a
    future implementer two designs. This file is long precisely so it can be
    wrong in one place; keep it saying one thing.

### Steps

**One step per pull request.** The first attempt did the whole issue at once
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

- [x] **4. Common effects.** Move `sandbox` and `catch` out of `effects/node`
      into a shared module that `effects/node` re-exports unchanged, so
      node-side callers keep one import. The re-export is legitimate here by
      [node-module-layering](../../effects/todo/node-module-layering.md)'s own
      test — a re-export is a shim only when it keeps a *dead* coupling
      alive, and `NodeOp` is declared over `Sandbox` and `Catch`, so
      `effects/node` genuinely uses what it re-exports. The modules the move
      exists for — the shared traversal, the browser interpreter — import the
      new home directly.

      **The list was settled by measurement, then shrank again by design.**
      The reverted #1759 interpreter implemented exactly `sandbox`, `catch`
      and `all`, so exactly those three had a second implementer. Under the
      sequential plan the traversal performs no `all`, so the set with two
      implementers — and this step's whole scope — is **`sandbox` and
      `catch`**. `all` is not this step's to move at all: its home is
      [node-module-layering](../../effects/todo/node-module-layering.md)'s
      question, which moves it to `effects/all` on the layering argument, with
      the Node runners and the registration path as its implementers. `await` never qualified: it belongs to that
      registration path, which no browser runs — though it *moves* with
      `sandbox` and `catch`, to the same `effects/sandbox` home, on
      node-module-layering's layering argument rather than on this step's
      second-implementer one; that move is that issue's, not step 4's. `now`
      and `fetch` never qualified either: a page reads its own wall clock and
      fetches nothing, in the impure shell where host values belong.
      Everything without a second implementer stays in `effects/node` until
      something gives it one — the same rule that shrank this list twice.
      [node-module-layering](../../effects/todo/node-module-layering.md)
      carries the same answer.

      **`import` was on that list and should not have been**, which was found
      later and is corrected there rather than here. "A page loads modules
      through its own importer" describes a *callback parameter*, and a
      callback is an operation nobody has named — so counting implementers by
      dispatched commands could not see the page's `import()` at all. It moved
      to `effects/common` once it was named.

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
      the guard needed a second operation and this took it; what each of its
      three call sites is worth is written down under `Catch` in
      [`fjs/effects/common/types.ts`](../../effects/common/types.ts). `fjs t` gained the behaviour in the process, which is
      what made that change worth landing on its own rather than inside the port.

- [x] **5. A browser interpreter** for `sandbox` and `catch`, plus whatever
      operations the application adds — for the page, one `report`. Nothing
      else: a sequential traversal performs no `all`. `sandbox` is
      `effects/node`'s, copied rather than redesigned, because two runners
      that disagreed about an awaited leaf would not be one runner; `catch`
      dispatches to `types/result`'s `tryCatch`, the same helper
      `effects/node` uses.

      **No scheduling policy of its own — and this time that holds without a
      footnote.** The reverted #1759 interpreter had to carry a frame budget
      because the concurrent traversal ran as one microtask drain (catalog
      item 1). Sequentially, the page's own `report` handler yields, and the
      interpreter's handlers are dumb. Its contract still wants the reverted
      attempt's proofs re-landed: a complete non-`Partial` map, a panic on a
      colliding or unclaimed command, handlers carried by descriptor, the map
      read once (catalog items 5, 8, 10).
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
      fold's summed durations. When this landed the reason was concurrency;
      under the sequential plan the two draw closer but stay distinct — wall
      clock also carries what is *between* the leaves: the per-report yields,
      enumeration, joining, everything the run does that no leaf owns. (Not
      module loading: the page's timer starts after its imports settle, and
      keeps doing so.) Step 7b updates this reasoning where it is published,
      in `RunTotals`'s JSDoc (`types.ts`), which today still explains the gap
      by concurrency.
- [x] **7. One sequential skeleton.** Two PRs, in this order.

      **7a. Make the shared traversal sequential**, in `module.f.mjs` alone.
      Replace the `all` fan-outs with a sequential fold: one leaf's whole
      chain — test, report, children — awaited before the next leaf starts,
      for siblings and for modules alike. Console-observable and
      console-provable: `fjs t` prints each line as its test finishes, in
      structural order, and per-leaf durations become the leaf's own time.
      Breaking (scheduling semantics), so it carries its own changelog entry.
      Run the full suite under it *in this PR* — a proof that depends on a
      sibling running concurrently deadlocks here, where it is cheap to find,
      not in the browser port. The suite run is *not* the proof of the
      sequential contract, though: the suite is green under the concurrent
      traversal too, so it would stay green if a later edit restored a
      fan-out. The contract gets its own proof, one that fails when work
      overlaps — leaves that record enter/exit order under a mock interpreter
      and assert no interleaving between one leaf's start and its finish, or
      an assertion that the traversal's chain issues no `all` command — and
      per catalog item 11's discipline the proof is mutation-tested: restore
      one fan-out, watch it fail, revert.

      **Landed in functionalscript#1774.** `walkEntries` and `runModuleMap`
      fold with `foldStep` instead of `allOk`; `sequential.proof.mjs` states
      the order on a runner that can interleave, and both fan-outs were
      restored one at a time to watch the matching proof fail. What it
      measured, for whoever revisits the cost: the suite's wall clock moved
      61.6 s → 62.6 s, while the `Time:` line it prints moved 754 s → 60.9 s,
      because a concurrent leaf's duration counted its siblings' work — one
      1.4 ms proof had been reporting 17.6 s. Speed was not a goal, and the
      number that was wrong is the one that got fixed. Review then found two
      things worth carrying forward. `foldStep` nested one continuation per
      item, which put a ceiling of ~10,000 sibling leaves on a sequential
      walk — *lower* than the `all` spread it replaced, and fixed in `effects`
      in the same PR, so a module of 200,000 leaves now walks in about a
      second; catalog item 9's "joins must be linear" applies to continuations
      too, and nobody had looked. And the proof written for *that* guarded
      only half of what its comment claimed — an all-`pure` fold never
      accumulated depth, because `resultStep` collapses a `Pure` head as it is
      built — so the guard became a pair, one fold of commands and one of
      values, each failing for its own mistake. Item 11 again, one level down:
      a proof of a scheduling property has to perform the thing being
      scheduled.

      Then a third: **a tree has two dimensions, and flattening one is not
      flattening the other.** With siblings folded, a leaf's returned children
      were still walked *inside* that leaf's own continuation, so an ancestor's
      frame stayed pending for its whole subtree — the exact shape just removed
      along a list, rebuilt along a path. A leaf returning a 5,000-deep chain of
      single children died with `RangeError` where the fan-out it replaced had
      not, because `all`'s handler ran each child effect through a fresh
      interpreter call and so reset the chain at every level. The fix is a
      work-list: `effects`' new `walkStep` lets an item answer further items,
      which go in front of the ones that remain, so a child is another item in
      the same loop and depth costs what breadth costs. Worth knowing for 7b,
      and generally: "does it fan out" and "does it recurse" are separate
      questions, and the answer to one says nothing about the other. Two
      measurements that are *not* this change's to fix came out of the same
      run: a returned tree costs quadratic time in its own depth regardless of
      the traversal — each level copies the path array — and both shapes take
      the same 7 s at 5,000 levels, so a proof of the depth property costs
      seconds inside `emergent_testing` and lives in `effects` instead, where
      20,000 levels cost 34 ms (catalog item 9 on the proof's own cost).

      **7b. The page runs the shared traversal** through the step-5
      interpreter. `browser.mjs` stops discovering leaves, applying the throw
      expectation, walking return values and counting: it supplies a
      `Reporter` whose `result` hands the record to its `report` operation,
      and a `report` handler that appends the row and awaits one macrotask.
      That await is the port's only boundary against the single-task freeze
      (catalog item 1), and the page proof's fake document cannot see
      painting — every semantic assertion stays green with the await
      deleted, the incidental-yield trap item 11 names. So the boundary gets
      its own ordering proof: a macrotask enqueued before a result is
      reported must be observed to fire before the next leaf runs,
      mutation-checked by removing the await and watching the sentinel land
      after the whole suite instead.
      Update `RunTotals`'s JSDoc in `types.ts` here too: it explains
      wall-clock-vs-summed-duration by leaves running concurrently, and under
      this step the gap is what the run does *between* leaves — per-report
      yields, enumeration, joining — not concurrency. Module loading is not
      part of it: the page's timer starts after its imports have settled, and
      stays there (step 6's note carries the same correction).
      **Landed, and without the `RunOutcome<R>` below.** That is the one
      substantial deviation from this design, so it is recorded rather than
      quietly taken. The plan had the traversal thread each host's leaf
      records out through its return value, which meant a breaking change to
      `runModuleMap`'s answer, an `exitCodeOf` helper, and every importer
      migrated. None of it was needed: the page must have a `report`
      operation anyway, for the live rendering this step is about, and that
      operation already carries every record in the walk's order. Threading
      them through the return as well would collect the same records twice.
      `runModuleMap` still answers `0 | 1`, nothing broke, and the page folds
      its report from what it collected.

      The page's modules stay a list, and the seam this design asked for is
      why. `runEntries` takes a module's **already-collected** leaves, so the
      page enumerates the export itself, once, under its own guard — items 5
      and 6 together. An unreadable export is that page's failed module, as
      before; the traversal read a module's own `proof` unguarded for `fjs t`
      until functionalscript#1830 guarded that one too, so both call sites are
      guarded now and the seam is still two.

      **Skipping that seam is what a first attempt did, and review caught what
      it cost.** Calling `runModuleMap` once per module also preserves a
      duplicate label, so it looked equivalent; it is not, because it leaves
      the enumeration inside the effect. An unreadable export and an
      interpreter that cannot dispatch then arrive by the same route — a
      rejection — and become indistinguishable, so one of them is reported
      wrongly whichever way the `catch` is written. Ambiguity introduced by
      the port, resolved by the design the plan already had.

      **What is still not provable, and why that is the next step.** Both
      runner-failure routes now end in `infrastructure-error` (item 8), and
      nothing states it: the routing lives in `runBrowserProofs`, an impure
      `async` function, and the failure it routes can only come from the
      interpreter it builds internally. Two ways to reach it were tried and
      both are wrong. Replacing `globalThis.setTimeout` broke twenty-four
      unrelated proofs under `fjs test`, whose registration path runs proofs
      *concurrently*, and was timing-dependent enough to stay green locally —
      a proof that reaches outside its own values is not isolated. Passing the
      yield in as a parameter is the same reach with a nicer name: a seam that
      exists for the test.

      The answer is the virtual interpreter, and it needs the orchestration to
      be an *effect*. Enumerating a module, walking its entries, routing a
      failure and folding a report are all pure logic over operations; only
      rendering and the wall clock are the host's. Moved into `.f.mjs` behind
      `report`, the whole of it is drivable by `effects/node/virtual` — a
      runner that simply refuses `report` produces the failure this proof
      needs, with nothing injected and nothing global touched. That is the same
      reason `fjs t`'s traversal is provable and this is not, and it is the
      next step here rather than a cleanup: the JavaScript that remains in
      `browser.mjs` is exactly the JavaScript that cannot be proven.

      **The page needed no browser-specific effect.** Its interpreter is
      `asyncRun` over `commonOperationMap` plus its own `report` — nothing
      else. So `effects/browser` still has no content to hold, which is now
      recorded in `../../effects/todo/node-module-layering.md` where that
      module is proposed. What a second host turned out to need was the
      operations moving *out* of `effects/node`, not a directory of its own.

      What the reverted #1759 validated, for whoever revisits this: the
      traversal threading a `RunOutcome<R>` — folded totals plus each host's
      leaf records in the walk's order (`fjs t` answers `void` and collects
      nothing).
      **That is a breaking change to `runModuleMap`'s exported answer** —
      today it is an exit code, `0 | 1` — and re-landing it carries the same
      obligations it carried the first time: an `exitCodeOf` helper for
      callers that want the code, every in-repo importer migrated in the same
      PR, and a changelog entry with the `**BREAKING CHANGES:**` prefix
      naming the return-shape migration — and, in the same entry, the two
      page-behaviour changes this port carries: the page's scheduling moves
      from 25-at-a-time concurrent batches to the sequential traversal (7a
      changed only `module.f.mjs`; the browser acquires the scheduling
      here), and live progress adopts the structural order (the paragraph
      below). Both are proved in this PR, not just listed. Also re-landed: the page's modules
      stay a *list* entered at a seam for already-collected leaves, because
      labels may repeat and an export is enumerated exactly once, under the
      page's own guard (catalog items 5, 6); the run starts only after its
      promise is published (item 7); and both runner-failure routes end in
      the `infrastructure-error` report (item 8).

      **One observable ordering change rides with this port, deliberately.**
      Today's page announces a returned tree's *children before their parent*
      — the parent's `result` callback fires after `Promise.all(children)` —
      while the shared traversal reports a parent before the children its
      return value produced, which is the structural order the report and
      `fjs t` already use. The port adopts the shared order for live progress
      too; prove it rather than inheriting it silently.

      **Reading a *module's* exported tree stays the page's own, and is now
      guarded on both sides.** This used to say the shared walk deliberately
      leaves that read unguarded "because there is no leaf to attribute the
      failure to". The second half did not survive being written down — the
      module is the attribution — so functionalscript#1830 guarded
      `runModule`'s read too and named the record for the module, which is what
      the page had been doing all along.

      What did *not* change is the seam: there are **two guarded call sites**,
      and a step-8 implementer needs both. The page enumerates the export
      itself, under its own `catch`, because it builds a `_BrowserTestResult`
      with `message` and `stack` from the value — and because the export must
      not be read twice, it then enters `runEntries` with the entries it
      collected. `runModule` guards the read for a host that hands the *value*
      over instead. Routing the page through `runModule` would read the export
      a second time and lose the description its report carries.

- [x] **8. The layout move**, and the website preparation program. Every task
      it names has landed: `emergent_testing/browser/module.f.mjs` holds the
      pure half and `browser/module.mjs` the host, the generated website entry
      and suite manifest regenerate to the new paths, and the preparation
      program moved into `website/module.f.mjs` with `browser-prepare.mjs`
      deleted (functionalscript#1827).

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

### Why steps 4 through 7 were worth taking

They looked like tidying — move some operations, add an interpreter, share a
reporter, delete a traversal. They were not. They drew a boundary the browser
runner did not have, and the promise episode is what its absence cost. All four
have landed; this section is why, kept because the reasoning outlives the
steps.

`browser.mjs` was impure `.mjs`, so a live host promise and a proof tree
travelled the same code path, and the code had to ask *which of these is a
promise?* That
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
`.mjs` only as a thin host boundary — and by that measure `browser.mjs` was
migration debt: roughly 200 of its 405 lines were logic wearing one host touch.
Most of that is now `browser/module.f.mjs`.
That is recorded in
[move the browser runner's business logic to FunctionalScript](browser-runner-functional-script.md),
which is the same work seen from the purity side rather than the sharing side.

So those steps were that boundary, applied to the browser:

- **step 4** put the host-independent operations somewhere both hosts can name;
- **step 5** gave the browser an interpreter, which is where its host values
  belong;
- **steps 6 and 7** moved reporting and traversal into the pure core, which is
  where host values must never be.

With them done, `instanceof Promise` lives in interpreters, as glue, and no
shared code asks the question. The asks have left the browser file: the two
that survive are in `effects/common`'s `sandbox` and
`effects/node`'s `await`, which are interpreters — though `effects/common` is
shared by design, so this is not yet the "exactly one" the goal names. They are
in the right *place* only because the boundary has not been drawn
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
`emergent_testing/browser/module.mjs` — **done**, once the orchestration had
already left it, so the move was a rename and its importers rather than a
rewrite. It should become a thin impure shell:
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

**The traversal is sequential, and that is the scheduling policy — the whole
of it.** The second attempt proved the alternative: a concurrent traversal
needed a frame budget to stay responsive and still delivered its log as one
burst, because no scheduling layer can reorder a continuation ahead of work
already queued (catalog items 1–2). Sequentially, the only scheduling decision
left is the page's one macrotask per report, in the page's own handler. `all`
keeps its start-every-child-before-awaiting-any contract for the programs that
still use it — the registration path, and any program that wants concurrency —
but the traversal is no longer one of them.

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
      answers with; the page supplies the parts and nothing else. Implemented
      and review-validated in the reverted #1759; the design survives as the
      plan and re-lands with step 7.
- [x] Name the skeleton's parts explicitly — execute a leaf, report a result,
      link a module — and check that nothing host-specific is left outside one
      of them. `test`, `result` and `summary` are the parts; linking a module
      stays outside the skeleton, which is why the reverted #1759 gave
      `runModuleMap` a sibling entry point taking already-collected leaves,
      and step 7b does again.
- [x] Make the existing `collectTests`/path behavior the single source of truth
      for console and browser execution. Done in the reverted #1759 — the
      page's walk was deleted, `collectTests` called once under the page's own
      guard — and re-landed with step 7b: `browser/module.f.mjs` imports
      `collectTests` from `../module.f.mjs` and has no walk of its own.
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
      They do not — but not for the reason first recorded, and the difference
      matters. The reverted #1759 interpreter needed `sandbox`, `catch` and
      `all` and nothing else, and the sequential plan drops `all` too (the
      loading walk borrowed it back for one PR and gave it up again), which
      was read as "import, time, yield and publication are all the page's, in
      its impure shell". Import was not: it was a callback parameter, which is
      an operation nobody had named, and it now lives in `effects/common` with
      two implementers. Time, yield and publication remain the page's. The
      answer to the question asked — no `fjs/effects/browser/` — is unchanged,
      because a shared operation does not belong in a browser-only directory
      either. Recorded in
      [node-module-layering](../../effects/todo/node-module-layering.md).
- [x] Move the browser's module loading behind operations. `import` is
      `effects/common`'s (functionalscript#1812), so the walk over sources is
      `browser/module.f.mjs`'s `loadProofs` and the page implements the one
      capability it needs: `import()` against its own document. The `importer`
      parameter is gone — an injected function is an unnamed operation, and
      naming it is what let the walk move.

      **The walk loads one module at a time** (functionalscript#1818). It first
      kept the old concurrency by dispatching `all`, which the page answered
      with `Promise.all`, and that was a step backwards on this issue's own
      terms: it put the browser back inside the variadic-`all` ceiling (item 3
      below, which the sequential traversal had just taken it out of), made the
      page's interpreter implement concurrency, and left a walk in which no
      branch knew what any other had done. The engine-specific proof written
      for that ceiling then failed on bun, which has no ceiling where node
      does. The sequential fold costs a cold page the difference between the
      slowest import and the sum of 141 of them, and buys the shape every
      other walk in this package has.
- [x] Move static proof discovery and `_browser-suite.mjs` generation into
      `fjs/website/module.f.mjs`; extend `fjs/effects/node/` only for a concrete
      missing capability and prove the real and virtual interpretations.
      **No operation was missing**: `readdir`, `readFile` and `writeFile` were
      already there, and `readdir`'s own `recursive` option replaced the
      hand-rolled directory recursion. What the move buys is the proof — the
      generator runs against `effects/node/virtual`'s in-memory tree, so a
      manifest is asserted from a directory of fixtures instead of being
      checked by running the command and reading a `git diff`.
- [x] Delete `fjs/website/browser-prepare.mjs` and make the sole `website`
      command `node ./fjs/module.mjs r ./fjs/website/module.f.mjs` once the
      FunctionalScript generator owns the complete build; do not restore the
      removed `index-html` alias. Done with the discovery move above: the
      script had nothing left to do.
- [x] Add `emergent_testing/browser/module.f.mjs` for pure browser application
      composition and its complete proof. **The orchestration moved: enumerate
      a module, walk its entries, route a failure, decide how the run ended.**
      Its own proofs cover it completely and none of them is a browser — the
      point of moving it. Two things the move revealed, both fixed rather than
      recorded, because both were the type lying about the code:
      `runEntries` has **no error channel** (every failure a leaf's chain meets
      is recorded in `RunState.aborted` and answered as a value), and the walk
      needs only three of a reporter's events, so `LeafReporter` was split out
      of `Reporter`. The browser was supplying a `summary` nothing ever called.
      What is left in `browser.mjs` is the interpreter, the DOM, the wall
      clock and `navigator`.
- [x] Move the current browser host code to
      `emergent_testing/browser/module.mjs` and reduce it to capability
      interpretation, DOM rendering, and browser publication. The reduction
      came first — the orchestration moved to `browser/module.f.mjs` — so this
      was the rename and its importers, and the directory now reads as one
      unit: logic, host, private types, and a proof for each.
- [x] Update the generated website entry and browser-test application imports
      to the new module paths. Both are *generated*, so the check is that
      regenerating them produces the new path rather than that a hand edit
      matched: `npm run website` rewrites the entry, and the browser suite
      manifest is derived the same way.
- [x] Prove the page's *rejection* runner-failure route. **Landed**, with the
      seam 7b specified: `_runBrowserProofsWith` hands the page's own operation
      map to a function before interpreting it, so a proof can replace one
      handler. The published `runBrowserProofs` is that core applied to the
      identity, so the page's entry point is unchanged — a testing seam, not
      the API widening this file rejected.

      Two proofs, because the rejection has two depths and only one of them
      reaches a handler: `aThrowingHandlerIsTheRunnersOwnFailure` (a `sandbox`
      handler throws) and `anUndispatchableCommandIsTheSameFailure` (no
      `sandbox` handler at all, which `match` panics on inside the same awaited
      loop). Both assert what the page actually depends on — the report still
      *resolves*, says `infrastructure-error`, and names the runner rather than
      a module. Mutation-checked: delete `.catch(runnerFailure)` and they
      reject instead of reporting, which is the page-stuck-in-`running`
      failure itself.

      The other route landed in 7b without a seam: an operation answering
      through its error channel is `refusedReportEndsTheRun` in
      `browser/proof.f.mjs`.
- [ ] Prove both runners produce equivalent paths, throw outcomes, recursive
      test counts, and normalized failures from the same fixtures. The
      existing `nameMatchesTheConsoleRunner`,
      `expectedThrowStatusMatchesTheSharedOne` and
      `normalizedResultMatchesTheSharedOne` already assert against the console
      runner's own functions; step 7b makes the four properties shared code
      rather than agreeing implementations.
- [x] Record every behaviour the browser file has today and the shared core will
      not keep, as an issue, before the sharing change merges. Two: the
      `batchSize = 25` yielding — whose *constant* was the mistake and whose
      *yielding* was load-bearing, see below — and the unguarded read of a
      module's *exported* tree, which stays the page's own — both are closed
      below.
- [x] Close each of those issues for both runners at once, so the two stay in
      sync rather than drifting from the day the core is shared. Both are
      closed, and *where* differs by which one it is.

      The `batchSize` yielding is **host-local by design**: it became one
      macrotask per report in the page's own `report` handler (step 7b), which
      is where scheduling belongs — `fjs t` yields nothing, because a terminal
      needs no paint.

      The unguarded reads became `catch`, and the reads are shared while the
      *call sites* are not all: a leaf's returned tree in the traversal
      (functionalscript#1809), a module's export at two guarded sites — the
      page's own, because it builds its report row from the value, and
      `runModule`'s for a host that hands the value over
      (functionalscript#1830) — and a thrown value through the core's `text`,
      which both reporters call (functionalscript#1832).
- [x] Decide where a browser run gives the thread back. **One macrotask per
      report, in the page's own `report` handler** — the sequential plan's
      answer, superseding the reverted #1759's frame budget. The full story
      of how the frame budget was got wrong three times before being measured,
      and why even measured-correct it could not fix the reporting burst, is
      the pitfall catalog above (items 1, 2, 4, 11, 12).
- [x] Prove `runBrowserProofs`'s `infrastructure-error` branch — the run's
      own failure, as opposed to any proof's — **in step 7b, with the
      minimal seam that makes it reachable.** Done by the move above rather
      than by a seam: with the orchestration an effect, a mock runner that
      declares `report` and does not implement it answers `notImplemented`
      through the ordinary continuation, which is the failure a page meets
      when its own reporting breaks. `browser/proof.f.mjs` pins that the run
      *stops* there and that the failure is answered rather than announced —
      announcing is what broke.

      **One half stays unproven and is now the only half.** A rejection —
      a handler of the page's own interpreter throwing — cannot be produced
      by a runner that answers through a continuation, so it is still the
      `catch` in `browser.mjs`. It is also no longer a *routing* decision:
      the walk is one effect now, so a rejection is not attributable to the
      module it happened under, and the row it produces is named after the
      runner rather than a module. That is a fault of this file rather than
      of any module, which is what the name says. Neither half of the branch (an
      operation reporting through the error channel, or one the interpreter
      cannot dispatch, which rejects) is reachable through the public entry
      point — the reverted #1759 proved that by mutation: removing the guard
      stayed green. An earlier version of this task concluded "land the
      guard in 7b, record it unproven, prove it at step 8's
      `module.f.mjs`/`module.mjs` split" — superseded, because that ships a
      branch known to be untested whose failure mode is a page stuck in
      `running` forever, exactly the class of hazard catalog item 11 exists
      for. 7b was to carry the seam itself, at its smallest: the page's run core
      taking its interpreter (or reporter) as an argument and exported for
      proofs from the page's own module, so proofs could drive **each failure
      route separately**.

      **7b landed one route without the seam, and the seam came after.**
      Making the orchestration an effect was enough for the error channel: a
      mock runner that declares `report` and does not implement it answers
      `notImplemented` through the ordinary continuation, which is
      `refusedReportEndsTheRun`. The rejection route could not follow, because
      `browser/module.mjs` built its interpreter internally and
      `.catch(runnerFailure)` had no way in. `_runBrowserProofsWith` is that
      seam, at its smallest: the page's own operation map passes through a
      function before it is interpreted, and the published
      `runBrowserProofs` is the core applied to the identity, so the entry
      point is unchanged — a testing seam, not the API widening the
      "widen the API to reach the branch" alternative proposed.

      What it made provable is the failure mode this was about: with the guard
      deleted, both cases reject instead of reporting, which is the page left
      in `running` forever.

### Related

- [Browser testing](browser-testing.md) — browser-native application and runner
  requirements.
- [Test-runner behavior](661-test-runner-behavior.md) — documented differences
  that must remain intentional after sharing the core.
- [Test tree walker](65z-tf-test-tree-walker.md) — earlier work around recursive
  proof-tree traversal. Its sketch predates the sequential plan and hard-coded
  `all` sibling fan-out; that issue now requires the sibling combination to be
  the instantiation's parameter (sequential for the run path, fan-out for
  registration), so a later walker cannot undo step 7a's scheduling.
- `Catch` in [`fjs/effects/common/types.ts`](../../effects/common/types.ts) —
  the answer that decision reached: the three reads of user values a run
  guards, now shared rather than the browser's own.
- [Imports, promises and realms](imports-promises-realms.md) — the same, for the
  loading and promise-detection machinery.
- [Browser timer precision](timer-precision.md) — `sandbox` is shared, so its
  measurement is one decision for both hosts.
- [Report a test's name before running it](report-before-running.md) —
  reporting is the next thing worth sharing after the semantics.
