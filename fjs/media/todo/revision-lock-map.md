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
without resolution information, while a lock map exists specifically to resolve
those subjects to immutable content.

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

Conceptually, the derived TypeScript type is a sparse recursive record:

```ts
type LockValue = Hash | LockMap

type LockMap = Readonly<Partial<Record<string, LockValue>>>
```

A missing property is therefore a normal `undefined` result, not an impossible
state. Empty and partial maps are valid.

The lock map is resolution data, not another history object: it has no
`subject`, `parents`, `generation`, or independent lifecycle. Do not introduce
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

A direct hash value resolves the subject to that exact immutable content:

```json
{
  "B": "snapshot-hash-of-B",
  "C": "snapshot-hash-of-C"
}
```

The hash is the content selected for the subject, not the hash of a revision
blob. This is the same kind of value carried by `revision.snapshot`. Pure
validation checks only the recursive map shape and native cbase32 hashes; there
is no referenced revision whose `subject` must be loaded and compared with the
map key.

A lock may contain more subjects than a particular processor needs. Extra
bindings are valid and allow one environment to be useful for several mutually
related objects.

### Top-level starting point and current-subject precedence

The revision itself supplies the processing starting point:

```text
revision.subject -> revision.snapshot
```

This implicit top-level binding has precedence over a same-subject entry in the
revision's own `lock` map. For example:

```ts
{
    subject: A,
    snapshot: hashA1,
    lock: {
        A: hashA0,
    },
}
```

resolves top-level `A` to `hashA1`. A processor may warn that `lock[A]` is
shadowed or inconsistent, but it must not use `hashA0` as the top-level
starting content.

The format should not reject the redundant entry structurally. A future shared
lock map may legitimately contain a binding for `A` and then be reused by a
revision whose own snapshot intentionally overrides it.

This precedence applies only to the top-level revision. A nested scope may
explicitly bind the outer revision's subject to different content.

### Nested maps and scoped conflicts

A nested map introduces a new subject-specific resolution scope. It is intended
primarily for incompatible diamond dependencies or similar scoped conflicts.

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

The nested map **replaces** the enclosing lock scope; it does not overlay or
inherit outer bindings. Therefore an outer binding omitted by the nested map is
unresolved in that nested scope. Such a nested map is valid but partial.

For example:

```json
{
  "D": "snapshot-hash-of-D-v0",
  "B": {
    "B": "snapshot-hash-of-B"
  }
}
```

does not resolve `D` while processing `B`. A processor may obtain the missing
binding from revision history, caller input, current heads, or another defined
algorithm, but that result is not contained in this lock map.

A nested map is also allowed to omit a direct binding for the subject under
which it appears. That does not make the structure invalid; it makes that scope
partial. For example:

```json
{
  "B": {
    "C": {
      "A": "snapshot-hash-of-A0"
    }
  }
}
```

does not completely determine `B` or which `A` applies directly in the `B`
scope. Resolving those missing choices is outside the format and must be handled
by the algorithm consuming the partial lock.

Flat maps should remain the common representation. Nested maps are used only
when one shared binding for a subject is insufficient.

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

with the implicit top-level binding `A -> revision.snapshot`. The effective
resolution environment is therefore:

```text
A -> snapshot-hash-of-A
B -> snapshot-hash-of-B
C -> snapshot-hash-of-C
```

A future shared lock map could store all three explicit bindings and be reused
from A, B, or C; the selected revision's own snapshot would still override its
top-level same-subject entry.

### Partial, complete, and historical resolution

The `lock` field is optional and may be partial or complete for a particular
processor and operation.

- An absent lock means the revision carries no local resolution information.
- A partial lock constrains or records only some subject resolutions.
- A complete effective lock resolves every subject the processor needs in each
  active scope without consulting mutable subject heads.

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

The format does not prescribe inheritance from revision parents. Absence of a
local binding does not structurally mean either "inherit" or "resolve current
head". In contrast, the meaning of an inline nested map is fixed: it establishes
a replacement scope and never implicitly inherits its enclosing map.

### Future shared lock files

A future `vnd.fjs.lock` format may store a reusable, history-free `LockMap` so
large or shared environments do not have to be repeated inline. History for
such content would still use ordinary revisions when needed.

A future extension may also allow a hash in a lock map, or the revision's whole
`lock` field, to reference shared lock content. The target would be recognized
by its content dialect. This is out of scope for the first version; initially a
direct hash resolves a subject to immutable content.

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
      `['record', or(hash, lock)]` and derive its sparse TypeScript type.
- [ ] Add optional `lock` to the revision schema, decoder, validator, exported
      type, README shape, and examples.
- [ ] Keep pure validation store-independent: validate recursive map structure
      and native cbase32 content hashes.
- [ ] Specify and test top-level current-subject precedence: `snapshot` wins
      over a same-subject `lock` entry, which may produce a warning but remains
      structurally valid.
- [ ] Specify and test nested replacement-scope semantics: nested maps do not
      inherit enclosing bindings and may be partial.
- [ ] Add proofs for absent, empty, flat, and nested lock maps; missing lookups;
      invalid hashes; malformed recursive values; and preservation of nested
      map structure.
- [ ] Document that revisions with equal snapshots and different locks are
      valid and may be displayed as dependency-only changes.
- [ ] Document that resolution algorithms may inspect immutable revision
      history, while inheritance, precedence across historical sources, merge,
      and head-selection rules remain outside the media format.
- [ ] Add processor-facing follow-up work for producing or materializing a
      complete effective lock after subject resolution.
- [ ] Add cyclic-reference examples proving that lock entries select snapshot
      hashes and therefore do not introduce revision-hash cycles.
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
