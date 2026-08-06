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

Revision content and revision-subject resolution are closely related: a
revision that references mutable subjects cannot be processed reproducibly
without resolution information, while a lock map exists specifically to supply
immutable resolution choices to a resolver.

### Proposal

Extend `vnd.fjs.revision` with one optional recursive `lock` field. The intended
rtti shape is:

```ts
export const lock = () => ['record', or(hash, lock)] as const

export const revisionSchema = {
    dialect,
    subject: string,
    parents: array(hash),
    snapshot: hash,
    generation: number,
    archived: option(true),
    lock: option(lock),
} as const
```

Conceptually, the derived TypeScript type is a sparse recursive index:

```ts
type LockMap = {
    readonly [subject: string]: Hash | LockMap | undefined
}
```

The recursion is written directly in the index signature so the type is valid
TypeScript. A missing property produces `undefined`; empty and partial maps are
valid.

The lock map is resolver input, not another history object: it has no `subject`,
`parents`, `generation`, or independent lifecycle. Do not introduce
`vnd.fjs.lock` or `vnd.fjs.freeze` in the first version. Ordinary revisions
remain the only history representation.

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

### Direct lock entries

A lock map associates revision subjects with immutable content hashes or nested
lock maps.

A direct hash supplies one exact immutable content candidate for the subject:

```json
{
  "B": "snapshot-hash-of-B",
  "C": "snapshot-hash-of-C"
}
```

The hash is content selected for the subject, not the hash of a revision blob.
This is the same kind of value carried by `revision.snapshot`. Pure validation
checks only the recursive map shape and native cbase32 hashes; there is no
referenced revision whose `subject` must be loaded and compared with the key.

A lock may contain more subjects than a particular resolver uses. Extra
bindings are valid and allow one map to be reused for several related objects.

### Starting point

The revision supplies the initial content and subject:

```text
revision.subject -> revision.snapshot
```

This is the processing starting point, but the format does not define a general
precedence rule between that starting binding and every occurrence of the same
subject inside the lock map. For example:

```ts
{
    subject: A,
    snapshot: hashA1,
    lock: {
        A: hashA0,
    },
}
```

starts processing from `hashA1`, while `lock[A]` supplies another resolution
candidate that a resolver may ignore, warn about, use in a different scope, or
otherwise interpret according to its algorithm. If the resolver cannot choose
unambiguously, the map is insufficient for that resolver invocation.

The format should not reject this structure. A future shared lock map may
legitimately contain `A`, and different resolvers or operations may use that
entry differently.

### Nested maps and scoped conflicts

A nested map supplies subject-specific scoped resolution information. Its main
intended use is incompatible diamond dependencies or similar conflicts.

For example:

```text
A -> B
A -> C
B -> D(v1)
C -> D(v2)
```

can be represented as:

```json
{
  "B": {
    "B": "snapshot-hash-of-B",
    "D": "snapshot-hash-of-D-v1"
  },
  "C": {
    "C": "snapshot-hash-of-C",
    "D": "snapshot-hash-of-D-v2"
  }
}
```

The format does not prescribe whether a nested map overlays its enclosing map,
replaces it, inherits selected entries, or participates in another resolver-
specific lookup rule. It records the scoped information only.

A nested map may omit the subject under which it appears or omit entries found
in an outer map:

```json
{
  "D": "snapshot-hash-of-D-v0",
  "B": {
    "C": {
      "A": "snapshot-hash-of-A0"
    }
  }
}
```

This is structurally valid. A resolver may be able to interpret it using its
history, caller environment, scope policy, or dependency model. If it cannot,
the map is insufficient for that resolver invocation. The ambiguity is not a
format error.

Flat maps should remain the common representation. Nested maps are used when a
single flat binding for a subject is not enough to express the available
resolution information.

### Cyclic subject references

A flat lock map can resolve mutually recursive subjects without creating a
content-addressing cycle because it maps subjects to snapshot/content hashes,
not to revision hashes whose bytes include their own lock maps.

For example, if A references B and C, and B references A and C, processing the
revision of A may use:

```json
{
  "B": "snapshot-hash-of-B",
  "C": "snapshot-hash-of-C"
}
```

with the initial binding `A -> revision.snapshot`. A resolver may therefore
construct the effective environment:

```text
A -> snapshot-hash-of-A
B -> snapshot-hash-of-B
C -> snapshot-hash-of-C
```

A future shared lock map could store all three explicit bindings and be reused
from A, B, or C.

### Resolver-relative sufficiency

A lock map is not intrinsically partial or complete. Sufficiency depends on:

- the resolver and its version;
- the starting revision and operation;
- resolver configuration and caller-provided inputs;
- the dependencies discovered while examining content.

A map is sufficient for one resolver invocation when that resolver can finish
without making additional unrecorded resolution choices. The same map may be
sufficient for one resolver and insufficient for another.

For example, one resolver may discover only `A -> B` and be satisfied by:

```json
{
  "B": "snapshot-hash-of-B"
}
```

Another resolver may inspect B's content and discover `B -> C`; the same map is
then insufficient for that invocation. A resolver may also encounter multiple
candidates, nested-scope ambiguity, or a missing binding and reach the same
conclusion.

`partial` and `complete` may be used as contextual shorthand, but never as
properties that can always be determined from the lock map alone.

### Resolver behavior and updated lock maps

Resolution algorithms are separate from the stored format. A resolver may, for
example:

- use current lock entries directly;
- inspect first-parent or multi-parent revision history;
- combine caller-provided resolution data with the revision-local map;
- inspect content to discover additional dependencies;
- consult mutable heads or another external source for unresolved choices;
- reject unresolved ambiguity;
- apply a deterministic resolver-specific policy;
- return an updated lock map containing choices and dependencies used or
  discovered during processing.

Looking into revision history does not by itself weaken reproducibility because
all parent references are immutable hashes. Reproducibility still depends on
using compatible resolver semantics.

A returned lock map is not necessarily universally complete. It records a more
explicit environment and may be sufficient to repeat the same operation with
the same resolver semantics. Another resolver may discover more dependencies or
require different information.

The revision format must not prescribe inheritance, precedence, conflict
resolution, scope lookup, dependency discovery, or head-selection algorithms.
Those belong to the resolver.

### Future shared lock files

A future `vnd.fjs.lock` format may store a reusable, history-free `LockMap` so
large or shared environments do not have to be repeated inline. History for
such content would still use ordinary revisions when needed.

A future extension may also allow a hash in a lock map, or the revision's whole
`lock` field, to reference shared lock content. The target would be recognized
by its content dialect. This is out of scope for the first version; initially a
direct hash supplies immutable content for a subject.

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

- [ ] Implement the lazy recursive rtti schema `lock` using
      `['record', or(hash, lock)]` and derive the inline recursive TypeScript
      index-signature type.
- [ ] Add optional `lock` to the revision schema, decoder, validator, exported
      type, README shape, and examples.
- [ ] Keep pure validation store-independent: validate recursive map structure
      and native cbase32 content hashes.
- [ ] Document that same-subject entries, missing entries, and conflicting
      entries are structurally valid resolver inputs rather than format-level
      errors.
- [ ] Document nested maps as scoped information without prescribing overlay,
      replacement, or inheritance semantics.
- [ ] Add proofs for absent, empty, flat, and nested lock maps; missing lookups;
      invalid hashes; malformed recursive values; and preservation of nested
      map structure.
- [ ] Document that revisions with equal snapshots and different locks are
      valid and may be displayed as dependency-only changes.
- [ ] Define resolver-facing terminology for contextual sufficiency instead of
      intrinsic lock completeness.
- [ ] Add processor-facing follow-up work for accepting an optional lock and
      returning an updated lock containing used or discovered resolution data.
- [ ] Add cyclic-reference examples proving that lock entries select snapshot
      hashes and therefore do not introduce revision-hash cycles.
- [ ] Reconcile the change with the revision dialect versioning rule before any
      records are emitted.

### Out of scope

- A separate lock/freeze history format with its own parents or generation.
- A mandatory universal dependency-resolution algorithm.
- Format-level precedence, scope inheritance, or conflict-resolution rules.
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
