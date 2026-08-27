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

`Reporter` has no event for it: `result` is called with a `SandboxResult`, so it
cannot be called before there is one.

### Preliminary design

Add a `start` (or `begin`) event to `Reporter`, called with the file and path
before the leaf is sandboxed, and let each host decide what to do with it:

- **`fjs t`** prints the name, then completes the line with `ok`/`error` and the
  duration when the result lands — the standard runner shape, and the format
  `fmtImport` already produces. Interleaving is the thing to get right: leaves
  run concurrently, so a half-written line cannot be left open across another
  test's output. Either the name and its outcome are one deferred line with the
  name shown live elsewhere, or output is a two-column log that names the start
  and closes it by identifier.
- **The browser page** renders a row in a pending state and settles it in place,
  which is the same list it renders now with one more state per row.
- **`TestResult`** may not need to change at all: a start is an event, not a
  result. Whether `report`/`reported` grow a sibling operation or the existing
  one gains a status is part of the design.

The `Reporter` change is small; the interleaving question is the real one, and
it is the same question in both hosts, which is an argument for settling it in
the shared core rather than twice.

### Constraints

- A start event must not cost a `sandbox` call or a clock read of its own: the
  duration reported is still the sandboxed one.
- Concurrency stays. Naming a test before running it must not serialize the
  suite to keep the output tidy.
- Whatever is emitted has to be as useful to an automated consumer as to a
  reader — a start with no matching result is precisely the signal a crashed
  run leaves behind, and a controller should be able to read it.

### Tasks

- [ ] Add the start event to `Reporter` and call it from `runModule` before the
      leaf is sandboxed.
- [ ] Decide the terminal format for concurrent output, and prove it.
- [ ] Render a pending row in the browser page and settle it in place.
- [ ] Prove that a run killed mid-test leaves the running test's name behind.

### Related

- [Share the whole runner](share-the-whole-runner.md) — reporting is one of the
  things each host still does its own way.
- [Hostile proof values](hostile-proof-values.md) — the crash case this would
  make diagnosable, where today the run ends with no summary and no name.
