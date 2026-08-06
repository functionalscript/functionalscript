## Revision lock map: reproducible revision-subject resolution

**Priority:** P3
**Status:** open

### Problem

A [`vnd.fjs.revision`](../revision/README.md) identifies an immutable snapshot
for one mutable `subject`, but that snapshot may reference other revision
subjects. Resolving those subjects through their current heads makes processing
non-reproducible: the same revision can produce a different result later even
when its own snapshot is unchanged.

Existing ecosystems address parts of this with generated files such as
`package-lock.json`, `deno.lock`, `bun.lock`, and `Cargo.lock`. Keeping those
files in source snapshots mixes source changes with external-resolution
changes, while creating a separate lock-history format would duplicate the
existing revision mechanism (`subject`, `parents`, `generation`, and
`snapshot`).

Revision content and revision-subject resolution are also closely related: a
revision that references mutable subjects cannot be processed reproducibly
without resolution information, while a lock map specifically resolves those
revision subjects.

### Proposal

Extend `vnd.fjs.revision` with one optional `lock` field:

```ts
export const revisionSchema = {
    dialect,
    subject: string,
    parents: array(hash),
    snapshot: hash,
    lock: option(lockMap),
    generation: number,
    archived: option(true),
} as const
```

Conceptually:

```ts
type LockValue = Hash | LockMap

type LockMap = Readonly<Record<string, LockValue>>
```

The exact lazy/recursive rtti expression is part of this task. The lock map is
resolution data, not another history object: it has no `subject`, `parents`,
`generation`, or independent lifecycle.

Do not introduce `vnd.fjs.lock` or `vnd.fjs.freeze` in the first version.
Ordinary revisions remain the only history representation.

### Revision history represents every kind of change

A revision may change its snapshot, its lock map, both, or neither relevant
field from an application's point of view.

For example, an external-dependency update may keep the source snapshot
unchanged:

```text
R0:
    snapshot = S0
    lock = M0

R1:
    parents = [R0]
    snapshot = S0
    lock = M1
```

Applications and APIs may present this as "source unchanged; dependencies
updated" by comparing fields. That is an interpretation of revision data, not
a reason to introduce a second history mechanism.

If someone wants to update dependency resolution for an old object rather than
move to a newer source revision, they can fork from the old revision:

```text
          R1
         /
R0 -----+
         \
          R0-lock-update
```

The existing revision DAG already represents this correctly.

### Lock-map semantics

A lock map associates revision subjects with immutable resolution values.

A direct hash value selects one exact revision for that subject:

```json
{
  "B": "revision-hash-of-B",
  "C": "revision-hash-of-C"
}
```

In the first version, a direct hash in a lock map must reference a revision
whose `subject` equals the map key. Checking the referenced blob and its subject
requires store access and therefore belongs to referential validation rather
than the pure shape validator.

The current revision supplies the processing starting point through its
`snapshot`. Its own subject is implicitly bound to the current revision while
processing, because a revision cannot contain its own content hash.

The same logical flat environment may contain more subjects than a particular
processor needs. Extra bindings are valid and allow one environment to be
useful for several mutually related objects.

### Nested maps and scoped conflicts

A nested map introduces a subject-specific resolution scope. It is intended
primarily for incompatible diamond dependencies or similar scoped conflicts.

For example:

```text
A -> B
A -> C
B -> D(v1)
C -> D(v2)
```

can be represented conceptually as:

```json
{
  "B": {
    "B": "revision-hash-of-B",
    "D": "revision-hash-of-D-v1"
  },
  "C": {
    "C": "revision-hash-of-C",
    "D": "revision-hash-of-D-v2"
  }
}
```

The outer key selects a scoped environment for that subject. The nested map
must directly bind the same subject to the exact revision selected in that
scope; otherwise entering the nested scope would not determine which revision
of the subject to process.

Flat maps should remain the common representation. Nested maps are not required
merely because one revision references another; they are used when one shared
binding for a subject is insufficient.

### Partial, complete, and historical resolution

The `lock` field is optional and may be partial or complete for a particular
processor and operation.

- An absent lock means the revision carries no local resolution information.
- A partial lock constrains or records only some subject resolutions.
- A complete effective lock resolves every subject the processor needs without
  consulting mutable subject heads.

These are semantic properties, not different schemas.

Resolution algorithms are deliberately separate from the stored format. An
algorithm may, for example:

- use only the current revision's lock;
- look through first-parent history for missing bindings;
- inspect several parents and report conflicts;
- combine a caller-provided environment with revision-local bindings;
- resolve remaining subjects through current heads while constructing an
  updated revision;
- materialize a complete lock map after successful processing.

Looking into revision history does not by itself weaken reproducibility because
all parents are immutable hashes. Reproducibility does require that the chosen
resolution algorithm and its precedence/conflict rules are defined by the
processor or by later shared resolution infrastructure.

The format must not silently prescribe one inheritance algorithm. In
particular, absence of a local binding does not structurally mean either
"inherit" or "resolve current head"; that is decided by the algorithm using the
revision.

### Mutually recursive subjects and CAS cycles

Revision subjects may form logical cycles, for example A referencing B while B
references A. A flat resolution environment can describe both bindings, but
embedding independently complete lock maps into both revision blobs can create
an impossible content-addressing cycle:

```text
hash(A) depends on a lock containing hash(B)
hash(B) depends on a lock containing hash(A)
```

The first version must not pretend this problem is solved by recursive maps.
Possible processing strategies include caller-provided scope, historical
resolution, partial local locks, or treating one revision as the current
implicit binding. A future history-free shared lock format may represent one
startless environment outside the mutually recursive revision blobs.

This limitation and the exact resolution behavior for cycles must be documented
rather than hidden in the pure schema.

### Future shared lock files

A future `vnd.fjs.lock` format may store a reusable, history-free `LockMap` so
large or mutually shared environments do not have to be repeated inline.
History for such content would still use ordinary revisions when needed.

That future format may also allow lock-map hash entries to reference either a
revision or a shared lock object, distinguished by dialect. This is explicitly
out of scope for the first version; initially a hash entry resolves directly to
a revision.

### Compatibility

Adding `lock` is structurally additive, but old readers would accept a revision,
ignore the lock, and could process the snapshot using mutable resolutions. That
is a semantic compatibility risk under the revision format's documented
versioning rule.

Before implementation, confirm that the pre-first-stored-record design window
still applies. If persistent `vnd.fjs.revision` records already exist and must
remain safely interpretable by old readers, introduce a new revision dialect
instead of silently reusing the old tag.

### Tasks

- [ ] Design and implement the recursive/lazy rtti schema for `LockMap` and
      derive its TypeScript type from the schema.
- [ ] Add optional `lock` to the revision schema, decoder, validator, exported
      type, README shape, and examples.
- [ ] Keep pure validation store-independent: validate map structure and native
      cbase32 hashes without loading referenced revisions.
- [ ] Add separate store-backed referential validation that direct hash entries
      resolve to revision blobs whose subjects equal their map keys.
- [ ] Specify the minimum nested-scope invariants, including the requirement
      that a nested map directly binds the subject under which it appears.
- [ ] Add proofs for absent, empty, flat, and nested lock maps; invalid hashes;
      malformed recursive values; and preservation of nested map structure.
- [ ] Document that revisions with equal snapshots and different locks are
      valid and may be displayed as dependency-only changes.
- [ ] Document that resolution algorithms may inspect immutable revision
      history, while inheritance, precedence, merge, and head-selection rules
      remain outside the media format.
- [ ] Add processor-facing follow-up work for producing or materializing a
      complete effective lock after subject resolution.
- [ ] Record and test the CAS-cycle limitation for mutually recursive
      self-contained revisions; do not claim that inline maps solve it.
- [ ] Reconcile the change with the revision dialect versioning rule before any
      records are emitted.

### Out of scope

- A separate lock/freeze history format with its own parents or generation.
- A mandatory universal dependency-resolution algorithm.
- Recursive merging of historical nested maps.
- Ecosystem-specific npm, Deno, Bun, Cargo, or Nix adapters.
- A shared `vnd.fjs.lock` blob format; it is a possible future extension.
- Full build reproducibility for compiler versions, platforms, configuration,
  undeclared environment state, or nondeterministic processors.

### Related

- [fjs/media/revision/README.md](../revision/README.md) — the current revision
  shape, parent ordering, generation rules, interpretability requirements, and
  dialect versioning policy
- [fjs/cas/evo/README.md](../../cas/evo/README.md) — revision storage and head
  operations that remain the only history infrastructure
- [fjs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — media-module placement and dialect naming conventions
