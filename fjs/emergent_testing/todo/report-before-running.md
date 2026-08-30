## Report a test's name before running it, not only after

**Priority:** P2
**Status:** wip

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

- **`fjs t`** opens the leaf's line before it runs — `name: ` with no
  newline — and closes it when the leaf lands: `ok, 1.2345 ms`. One line per
  leaf, the same line a reader of a finished log has always seen, with the
  name arriving early enough to say what is running now.

  The alternative considered and rejected was two complete records, the start
  naming the test and the result naming it again. It is the more defensive
  shape: no *other* leaf runs between a start and its own result under the
  sequential runner, but the leaf itself does, and anything it writes — a
  proof that logs at runtime (purity is a convention the sandbox does not
  enforce; see [hostile-proof-values](hostile-proof-values.md)), a Node
  warning — splices into an open line. That defence costs every reader a
  doubled log on every run to keep a rare case tidy, which is the wrong trade:
  the splice is *visible* when it happens, the name is on the stream either
  way, and a leaf that logs has already told the reader something worth
  seeing next to its own name.
- **The browser page** renders a row in a pending state and settles it in
  place — the same list it renders now with one more state per row — **and
  its start handler awaits one macrotask after rendering the pending row**,
  exactly as its `report` handler does after a result. Appending a DOM node
  does not paint it: without the yield, a proof that runs synchronously for
  seconds would run and settle the row before the first paint, and the
  running test this issue exists to show would never be visible. The yield
  sits before the sandboxed clock reads, so the reported duration is
  untouched (the constraint below).
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
  duration reported is still the sandboxed one. The browser start handler's
  macrotask yield (above) is compatible: it lands before the sandbox's
  adjacent clock reads, so it delays the start, not the measurement.
- The runner's scheduling is not this issue's to change, in either direction.
  When this was written that meant "concurrency stays"; the sequential plan in
  [share-browser-console-runner](share-browser-console-runner.md) has since
  made the traversal sequential, which this issue simply inherits — and
  benefits from: one leaf's events no longer interleave with another's, so a
  start is followed by its own result, in both hosts. What sequential does
  *not* buy is an empty gap between them — the leaf itself runs there, and
  its output can land on the same stream — which the terminal format above
  accepts rather than doubling every line to guard against.
- Whatever is emitted has to be as useful to an automated consumer as to a
  reader — a start with no matching result is precisely the signal a crashed
  run leaves behind, and a controller should be able to read it.
- The start event lands in both runners in the same change. Their output differs
  — a terminal line and a DOM row — but a runner that names a running test and
  one that does not are two different tools.

### What landed for `fjs t`

functionalscript#1790, alongside the deferral of the failure details that used
to interrupt the log (that issue's own file is gone with its fix, per the
workflow). `Reporter` grew a `start` event carrying a `TestId` —
the identity half of `TestResult`, split out so the two events that name a leaf
name it the same way — called inside the leaf's own chain ahead of `test`, so a
reporter that cannot announce a leaf ends the run rather than running one it
failed to announce. Its first form wrote two complete records — `name: running`
and then the result line naming the test again — and that doubling is what a
reader met first: every run twice as long, to guard a case that announces
itself when it happens. The format above replaced it: `start` opens the line
with `name: `, `result` closes it, and a run that is abandoned leaves its last
line open with the name on it, which was the point of the event. Everything
still goes to `stdout` — see [reporter modes](211-reporter-modes.md).

What that format does *not* serve is a consumer that reads lines: `name: ` is
not a record until the leaf lands, so a pipe or a log collector learns nothing
early and a killed run's last name can be dropped. That is a second format for
a second audience rather than a defect in this one — see
[TTY and line-oriented consumers](tty-and-line-consumers.md).

The browser half is **not** done and was deliberately left out of that change:
the page still renders a row only once a leaf has settled, and the pending row
plus its macrotask yield — the part with the real proof problem, since a fake
document cannot see painting — is what remains.

Worth recording for whoever does it: the `fjs t` start event was cheap because
the traversal already had the leaf's identity in hand and a place to put the
call. The browser's cost is not the event, it is the yield and proving it.

### Tasks

- [x] Add the start event to the reporter and call it before the
      leaf is sandboxed.
- [x] Decide the terminal format, and prove it. Under the sequential runner
      leaves do not interleave, so the question is the shape of a
      start-then-result pair rather than how to keep concurrent lines
      legible — but a leaf's *own* output can still land between its start
      and its result, so the proof includes a proof that writes to the
      terminal mid-test and shows both records intact around it.
      `defaultReporterOutputDuringATest` is that proof.
- [ ] Render a pending row in the browser page, await one macrotask in the
      start handler, and settle the row in place — and prove the *yield*,
      not the append. A proof body that reads the DOM proves nothing here:
      the pending node is appended synchronously before the await, so the
      DOM looks identical with the yield deleted, and a blocking body cannot
      see from inside its own task whether the browser painted first — an
      item-11 coincidence proof in either shape. The proof is an ordering
      sentinel: a macrotask enqueued before the start handler runs must be
      observed to fire before the proof body starts (or a real-browser
      observation of the painted row, as the burst was measured), and the
      mutation check is deleting the await and watching the sentinel land
      after the body instead.
- [x] Prove that a run killed mid-test leaves the running test's name behind
      (`startSurvivesARunThatDies`): the leaf's execution fails outright, so it
      is announced and never reported, and the unmatched start is the name.
      Both new proofs stay green when the announcement is merely moved to
      *after* the leaf runs — the event-order proofs cannot see that, since the
      start still precedes the result — which is why they exist.

### Related

- [Reporter modes](211-reporter-modes.md) — where the rule that every record
  goes to `stdout` is written down. It is what makes the pair of records above
  a *pair*: with failures on `stderr`, a failing leaf's two lines landed on two
  streams that are not ordered against each other.
- [Share the browser and console proof runners](share-browser-console-runner.md)
  — reporting is one of the things each host still does its own way, and this
  is the same question twice until they share a reporter.
- [Hostile proof values](hostile-proof-values.md) — the crash case this would
  make diagnosable, where today the run ends with no summary and no name.
