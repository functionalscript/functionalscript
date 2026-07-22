## Require all fields whose absence forces inference

**Priority:** P1
**Status:** done

### Problem

While the `vnd.fjs.revision` format is still being designed and **no
revision records exist anywhere**, requirement changes are free: they land
in-place, under the same dialect tag, with nothing stored to migrate.
This is a matter of record, not an assumption: the format was introduced
a few weeks ago, no released version of FunctionalScript has ever
included the evo API, and the only writers that have ever run are this
repository's own proofs against in-memory stores — no persistent store
has ever been populated with revision blobs. The same applies to every
semantic commitment made while designing the format (e.g. the
first-parent ordering in [`README.md`](../README.md)): there are no
pre-existing blobs whose meaning could shift. That
window closes the moment the first revision is written — after that, any
requirement change takes a new dialect (see the versioning rule in
[`README.md`](../README.md), and the rationale recorded in
[`fs/cas/evo/todo/evo-revision.md`](../../../cas/evo/todo/evo-revision.md)).
Hence P1, blocking: this must land before the API is used to create
revisions.

The rule: **a field whose absent value must be *derived from other data*
is required.** Optional stays reserved for fields whose absent value is a
constant default. Today two fields violate the rule:

- **`snapshot`** — the most inference-heavy field in the format. Its
  absence triggers the three-case resolution algorithm
  ([`README.md`](../README.md), "Snapshot resolution"): zero parents →
  fall back to `subject`, one parent → inherit the parent's snapshot,
  multiple parents → invalid. The inheritance case is *non-local*
  inference: resolving it means fetching the parent blob — and if that one
  also omitted `snapshot`, an ancestry walk to the nearest explicit one.
  The revision's actual content is unknowable without I/O.
- **`generation`** — absent means "re-derive from the ancestry", an
  ancestry walk for one integer. (Decided in
  [`fs/cas/evo/todo/evo-revision.md`](../../../cas/evo/todo/evo-revision.md);
  the format-level change is tracked here.)

### Change

Both become required in `revisionSchema` (`module.f.ts`):

- `snapshot`: `option(hash)` → `hash`. Every revision states its content
  explicitly — even when unchanged from a parent (an archive-only
  revision, a merge taking one side wholesale). The cost is one hash per
  blob; the payoff is that the whole resolution algorithm is deleted, and
  with it:
  - the `subject`-as-fallback special case — `subject` becomes purely an
    identity string, always, never conditionally validated as a hash;
  - the "absent with multiple parents" error case — there is no absent.
- `generation`: `option(number)` → `number`, "is a non-negative integer"
  enforced by `validate` on top of the structural schema (the same
  layering as `isHash`). Existence and integer-ness are the correctness
  check; equality with `1 + max(parents' generations)` is observed, not
  enforced — a deviation signals an epoch reset (see
  [`evo-revision.md`](../../../cas/evo/todo/evo-revision.md)), not an
  invalid blob.

**Not required — `archived`.** Its absence is not inference: the default
is the constant `false`, derivable from nothing. Forcing
`archived: false` onto every blob is pure noise, and `option(true)` is the
established presence-flag idiom. It stays optional, and this is the
documented boundary of the rule.

### The property this buys

With `snapshot` and `generation` required, **a revision blob is fully
interpretable in isolation**: no field's meaning ever requires fetching
another blob. Cross-blob *checks* remain — generation continuity,
same-subject parents — but those are signals and layer rules, not "what
does this blob say". The README should state this property explicitly; it
is the invariant future field proposals are measured against.

Inference doesn't disappear — it moves to the write boundary, where it
runs once, server-side, with the parents already resolved: `evo_add`
(`fs/cas/evo`) keeps its input conveniences (infer `subject` from the
single parent, compute `generation`, resolve an absent input `snapshot`
by the same rules the format used to carry) and writes every field
explicitly. APIs infer; the stored record never does.

### Future relaxation

A future format version may make a required field optional again — but
only together with a *specified inference algorithm* for the absent value,
and (per the versioning rule) under a new dialect, since readers of this
dialect reject blobs missing a required field. The relaxation and its
algorithm are one decision; this todo just keeps the door open.

### Tasks

- [x] `revisionSchema`: `snapshot` `option(hash)` → `hash`, `generation`
      `option(number)` → `number`; non-negative-integer check for
      `generation` in `validate`; remove the snapshot-resolution logic and
      the `subject`-as-hash fallback from `validate`/`decodeText`.
- [x] Proof coverage: missing/non-integer/negative `generation`, missing
      `snapshot`, and a zero-parent revision whose `subject` is not a hash
      (now valid — `subject` is never a snapshot reference).
- [x] `README.md`: update the schema snippet and field table (`snapshot`
      and `generation` required); delete the "Snapshot resolution"
      section; reframe the `generation` paragraph (correctness =
      existence + integer-ness, `1 + max` is what conforming writers
      produce, deviation = epoch-reset signal); state the
      interpretable-in-isolation property and the required-fields rule
      with the `archived` boundary; note the future-relaxation rule.
- [x] Land before any revision records are created (and in the same change
      as `evo_add` writing the required fields — see the sequencing note
      in [`evo-revision.md`](../../../cas/evo/todo/evo-revision.md)).

### Related

- [`fs/cas/evo/todo/evo-revision.md`](../../../cas/evo/todo/evo-revision.md)
  — the `generation` semantics (computed at `add`, epoch-reset signal) and
  the why-no-dialect-bump rationale this change relies on.
- [`fs/cas/evo/todo/subject-history.md`](../../../cas/evo/todo/subject-history.md)
  — the mainline walk whose `evo_revision` companion motivated requiring
  `generation`.
