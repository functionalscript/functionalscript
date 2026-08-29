## Add explicit browser test controls

**Priority:** P3
**Status:** wip

### Problem

The generated browser-test page now starts idle, waits for an explicit `Run`
click or controller call, and keeps that control genuinely disabled — not
merely click-ignoring — while a suite is loading or running. What remains is
the other half of the proposal below: there is still no way to stop a run
that is no longer useful, and no `Cancel` control expressing that a suite is
active.

### Proposal

Do not start tests when the page or entry module starts. The initial state is
idle and waits for an explicit user or controller action.

Provide two controls with opposite availability:

| Runner state | `Run` | `Cancel` |
| ------------ | ----- | -------- |
| idle         | active | passive |
| loading      | passive | active |
| running      | passive | active |
| completed    | active | passive |
| cancelled    | active | passive |

Use the label `Run`, not `Run again`; the same action starts both the first and
every subsequent run. “Passive” means a real disabled control, including its
accessible disabled state, rather than a click handler that silently ignores
the action.

Cancellation must be semantic, not merely visual. It should prevent unstarted
proofs from running, ignore late module imports and proof completions from the
cancelled run, and prevent that run from replacing a later run's progress,
report, promise, or completion event. Work already executing in JavaScript
cannot always be interrupted; cancellation should be cooperative at module
and leaf boundaries and document that limitation. (When this was filed the
page ran batches, and the batch boundary was a natural check point; the
sequential plan in [share-browser-console-runner](share-browser-console-runner.md)
removes batching, so the boundary that remains is between one leaf's whole
chain — test, report, children — and the next, which is finer-grained than
the batch boundary was.)

The final cancelled result needs a serializable status distinct from `failed`
and `infrastructure-error`. Decide whether cancellation dispatches the existing
completion event with a cancelled report or a separate event; automated
controllers must be able to distinguish cancellation without reading DOM text.

An automated controller may call the same start API explicitly after the page
loads, but the HTML application itself must not auto-run through its entry
module or a default query parameter.

### Tasks

- [x] Remove the entry module's automatic `start()` call.
- [x] Rename `Run again` to `Run`.
- [ ] Add a `Cancel` button and implement the inverse enabled/disabled states
      for `Run` and `Cancel`.
- [ ] Add a per-run cancellation token or equivalent identity checked during
      loading, at each sequential leaf boundary (the between-batches check
      this task once named — gone with batching, per the note above), and
      before every UI/global/event publication.
- [ ] Define the serializable cancelled report and completion-event behavior.
- [x] Prove initial idle behavior and `Run`'s state transitions across
      loading, running, and both terminal outcomes; cancellation-related
      proofs are deferred with the `Cancel` button above.

### Related

- [Browser testing](browser-testing.md) — the shared browser application and
  report contract.
- [Shared browser/console runner core](share-browser-console-runner.md) — future
  separation of pure runner state from DOM controls.
