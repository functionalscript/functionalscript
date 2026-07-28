## Change content format: incremental changes as their own dialect

**Priority:** P4
**Status:** open — no design yet

### Problem

[`vnd.fjs.revision`](../revision/README.md) carries only full materialized
content: every revision states its `snapshot` explicitly, and incremental
diffs were deliberately left out of that format. The reason is its versioning
rule — an optional `changes` field would be *schema*-additive but
*semantically* breaking, because a reader that did not implement diff replay
would still validate such a blob and silently materialize the base while
ignoring the changes.

So the snapshot half of the standard snapshot/delta dichotomy exists and the
delta half does not. Until it does, a producer of fine-grained edits (a text
editor, a collaborative session, a log of small state mutations) has to write
a full snapshot per step or invent its own ad hoc encoding outside the store's
vocabulary.

### Proposal

Define `vnd.fjs.change` as a **separate dialect**, served as
`application/vnd.fjs.change+json` — not a field of `vnd.fjs.revision`. A
reader that doesn't know the dialect fails detection instead of misreading a
revision, which is exactly what the versioning rule is there to guarantee.

Nothing beyond that is decided. Open design points:

- The change model itself: an event log, most likely CRDT-based (so
  concurrent edits merge without a central serializer), but the CRDT family
  and the operation vocabulary are unchosen.
- How a revision links to changes, given that the link must not weaken the
  "interpretable in isolation" property revisions have today — a reader that
  ignores changes must still materialize *correct* (if coarser) content, or
  the link is the same silent-misread trap in a new place.
- Whether changes are addressed as their own CAS blobs (a `hash[]` on the
  linking side) or batched into one blob per revision step.
- Where the module lives: `fjs/media/change/`, by the same cycle rule that
  puts the revision format under `fjs/media/` — the detector must be able to
  import a format's schema without depending on a store.

### Tasks

- [ ] Choose the change model (event log shape, CRDT family, operation
      vocabulary) and write it up as a design before any code.
- [ ] Decide how revisions reference changes without breaking
      interpretability in isolation.
- [ ] Create `fjs/media/change/` — the pure format: rtti schema, `dialect`
      constant, decode/validate, and a `README.md` spec, mirroring
      `fjs/media/revision/`.
- [ ] Teach `fjs/media` detection to recognize the dialect and report
      `application/vnd.fjs.change+json`, with proof coverage.

### Related

- [`fjs/media/revision/README.md`](../revision/README.md) — the snapshot half
  of the dichotomy, its versioning rule, and the "out of scope" entry this
  issue tracks
- [fjs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the `fjs/media/` membership and cycle rules placing this module, and the
  dialect naming convention
- `todo/plan/vision.md` — the multi-device / multi-user merge model a CRDT
  change log would serve
