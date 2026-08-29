## Report a test's name before running it, not only after

**Priority:** P2
**Status:** open

### Problem

Every runner reports a test only once it has finished. `fjs t` writes
`import("./a.proof.f.mjs").proof.x(): ok, 0.3 ms` after the fact, and the
browser page appends `PASS import("a").proof.x() (0.3 ms)` the same way. A test
that is *running* is invisible.

Three things follow from that, and the third is the one that matters:

- **A slow test looks like a hung runner.** Nothing distinguishes "this proof
  has been going for ten seconds" from "the runner stopped", so the only way to
  find the slow one is to wait for it to finish and read the duration.
- **Progress is a count, not a place.** The browser page says "1247 tests
  completed…" while a reader wants to know *which* one it is on.
- **A crash loses the one fact worth having.** When a proof takes the process
  down — a panic through the shared traversal, an out-of-memory, a stack
  overflow, a runner bug — the last line printed is the last test that
  *succeeded*, and the one that actually broke is never named. That is exactly
  the case where a name is worth more than a result, and it is the case where
  the current design has none.

No reporter has an event for it: `result` is called with a finished
`TestResult` and the `SandboxResult` it was read from, so it cannot be called
before there is one. The seam it would travel through does exist now — both
runners report through the same leaf-landed and run-ended events — so adding a
start event is adding a third event kind, not building the stream first.

### Preliminary design

Add a `start` (or `begin`) event to the reporter, called with the file and path
before the leaf is sandboxed, and let each host decide what to do with it:

- **`fjs t`** prints the name, then completes the line with `ok`/`error` and the
  duration when the result lands — the standard runner shape, in the format it
  already prints. When this was written leaves ran concurrently and
  interleaving was the thing to get right; under the sequential runner this
  issue inherits (see the constraint below), nothing runs between a start and
  its own result, so the open line is simply completed in place — no deferred
  lines, no two-column log, no identifier to close by.
- **The browser page** renders a row in a pending state and settles it in place,
  which is the same list it renders now with one more state per row.
- **A result type** may not need to change at all: a start is an event, not a
  result. Whether the reporter grows a sibling operation or its existing one
  gains a status is part of the design.

The reporter change is small, and the question that was the real one when
this was written — interleaving — is gone with the concurrency: under the
sequential runner nothing runs between a start and its own result. What
remains is the event's shape: whether the reporter grows a sibling operation
or its existing one gains a status, and what a start-then-result pair looks
like in each host. That is still the same question in both hosts, which is
still the argument for settling it in the shared core rather than twice.

### Constraints

- A start event must not cost a `sandbox` call or a clock read of its own: the
  duration reported is still the sandboxed one.
- The runner's scheduling is not this issue's to change, in either direction.
  When this was written that meant "concurrency stays"; the sequential plan in
  [share-browser-console-runner](share-browser-console-runner.md) has since
  made the traversal sequential, which this issue simply inherits — and
  benefits from: starts and results no longer interleave, so a start line is
  followed by its own result line, in both hosts.
- Whatever is emitted has to be as useful to an automated consumer as to a
  reader — a start with no matching result is precisely the signal a crashed
  run leaves behind, and a controller should be able to read it.
- The start event lands in both runners in the same change. Their output differs
  — a terminal line and a DOM row — but a runner that names a running test and
  one that does not are two different tools.

### Tasks

- [ ] Add the start event to the reporter and call it before the
      leaf is sandboxed.
- [ ] Decide the terminal format, and prove it. Under the sequential runner
      output does not interleave, so the question is the shape of a
      start-then-result pair rather than how to keep concurrent lines
      legible.
- [ ] Render a pending row in the browser page and settle it in place.
- [ ] Prove that a run killed mid-test leaves the running test's name behind.

### Related

- [Share the browser and console proof runners](share-browser-console-runner.md)
  — reporting is one of the things each host still does its own way, and this
  is the same question twice until they share a reporter.
- [Hostile proof values](hostile-proof-values.md) — the crash case this would
  make diagnosable, where today the run ends with no summary and no name.
