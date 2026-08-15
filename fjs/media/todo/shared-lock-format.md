## Shared lock format

**Priority:** P4
**Status:** open

### Problem

[`vnd.fjs.revision`](../revision/README.md)'s `lock` is an **inline** map: the
bindings live in the revision blob that uses them. That is the right default —
a revision stays interpretable in isolation — but it makes one map
unshareable in two directions:

- **Across a subject's own history.** A lock map holds one entry per resolved
  dependency, and nested scopes multiply that. A new revision whose bindings
  are unchanged (the ordinary case: the source moved, the dependencies did
  not) re-serializes the whole map into a new blob. CAS deduplicates whole
  blobs, not fragments, so nothing is shared and the map is stored again per
  step.
- **Across subjects.** Several components resolving the same dependency set
  cannot point at one agreed resolution; each carries its own copy, and
  keeping them equal is a convention nothing in the format checks.

A lock-only change correctly produces a new revision — a dependency-only
update is a real update, and equal snapshots with different lock maps are
valid. This issue is not about that; it is about the repetition when the lock
is what *stays the same*.

### Proposal

Two pieces, separable — the first is useful on its own and is the safe half.

**1. `vnd.fjs.lock`, a history-free lock blob.** A separate dialect, served as
`application/vnd.fjs.lock+json`, living in `fjs/media/lock/` by the same cycle
rule that puts the revision format under `fjs/media/`:

```ts
export const lockSchema = {
    dialect: 'vnd.fjs.lock',
    lock,
} as const
```

`lock` is imported from [`fjs/media/revision`](../revision/module.f.mjs), not
restated — one recursive schema, one semantic hash check, one canonical
serialization, so a map means the same thing inline and shared. No `subject`,
`parents`, `generation`, or `archived`: this dialect is a value, not a step.

History for lock content, when someone wants it, is an **ordinary revision**
whose `subject` identifies the lock and whose `snapshot` is a `vnd.fjs.lock`
blob. That is the whole point of keeping the blob history-free — no second
history mechanism appears, and `revision` stays the only one.

**2. A revision field referencing shared lock content.** This is the half
that needs a decision, because it is a *fail-open* change and the nested-map
widening was not.

Widening `lock` to nested maps kept the `vnd.fjs.revision` dialect precisely
because an older reader rejects what it cannot represent (see
[Widening `lock`](../revision/README.md#widening-lock)). A reference field has
the opposite failure mode: a reader that does not know it still validates the
blob and sees "no lock bindings were recorded" — the field's documented
constant meaning — so it resolves dependencies through mutable heads and
believes the result is reproducible. That is exactly the silent misread the
versioning rule exists to prevent, and it is the same trap that keeps
incremental diffs out of the format (see
[change-content-format](./change-content-format.md)).

So the reference form most likely requires `vnd.fjs.revision2` rather than an
additive field. Decide that before writing a schema; do not assume the
additive path just because piece 1 needs no dialect change at all.

Open design points:

- **Spelling.** A separate field (`lockRef: option(hash)`) versus widening
  `lock` itself to `or(hash, lock)` at the top level. The two are
  structurally distinguishable (a string is not an object), but overloading
  one field with "the bindings" and "where the bindings are" reads worse and
  buys nothing once a dialect bump is on the table anyway.
- **Combining.** Whether a revision may carry both an inline map and a
  reference, and if so what the format says about the pair — most likely
  nothing, consistent with its refusal to define overlay, inheritance, or
  precedence for nested maps.
- **Composition.** Whether a `vnd.fjs.lock` blob may itself reference further
  lock blobs. It can be made to: entries and references alike select content
  hashes, and a hash-consistent store cannot contain a cycle among them, so
  composition terminates for the same reason the format's acyclicity argument
  holds elsewhere. Whether it is *worth* it is the open part.
- **Validation boundary.** `fjs/media/revision` is pure format with no store
  access, so it can validate that a reference is a cbase32 hash and nothing
  more — the same contract `snapshot` already has. Following a reference is a
  resolver's job, and resolvers keep every semantic the format still declines
  to define.

### Tasks

- [ ] Create `fjs/media/lock/`: the `vnd.fjs.lock` dialect — schema reusing
      `fjs/media/revision`'s `lock`, `dialect` constant, decode/validate,
      `dialectEntry` registration, a `README.md` spec, and proofs.
- [ ] Teach `fjs/media` detection to recognize the dialect and report
      `application/vnd.fjs.lock+json`, with proof coverage.
- [ ] Prove that one map serializes identically inline and as a shared blob,
      so the two forms cannot drift.
- [ ] Decide the dialect question for the reference field before designing
      it: whether a revision referencing shared lock content can stay
      `vnd.fjs.revision` given that ignoring the field is fail-open.
- [ ] Design the reference field (spelling, whether it combines with an
      inline map, whether lock blobs compose), then implement it in the
      format, [`fjs/cas/evo`](../../cas/evo/README.md)'s `RevisionData`, and
      the `evo_add`/`evo_revision` tools together.
- [ ] Remove the "reusable, history-free lock format" entry from
      [`fjs/media/revision/README.md`](../revision/README.md)'s out-of-scope
      list as each half lands.

### Related

- [fjs/media/revision/README.md](../revision/README.md) — the inline `lock`
  map, its `Lock maps` and `Widening lock` sections, and the out-of-scope
  entry this issue tracks
- [change-content-format](./change-content-format.md) — the other deferred
  dialect, and the same fail-open versioning trap in a different field
- [fjs/cas/evo/README.md](../../cas/evo/README.md) — `RevisionData`, which a
  reference field would extend in both directions at once
- [fjs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the `fjs/media/` membership and cycle rules placing this module, and the
  dialect naming convention
