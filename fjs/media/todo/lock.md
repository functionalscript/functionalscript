## Lock file format: immutable revision-subject resolution

**Priority:** P3
**Status:** open

### Problem

A [`vnd.fjs.revision`](../revision/README.md) identifies immutable content for
one mutable `subject`, but that content may itself reference other revision
subjects. Resolving those subjects through their current heads makes the result
change over time even when the starting revision is unchanged.

Existing ecosystems solve parts of this problem with separate generated files
such as `package-lock.json`, `deno.lock`, `bun.lock`, and `Cargo.lock`. Keeping
those files in source history mixes two independent histories:

- source-content history, represented by revisions;
- external-subject resolution history, represented by locks.

The lock format should provide one content-addressed mechanism for recording
exact subject resolutions without making generated dependency state part of a
source snapshot.

### Proposal

Define `vnd.fjs.lock` as a separate JSON dialect, served as
`application/vnd.fjs.lock+json`, with a pure format module under
`fjs/media/lock/`.

```ts
export const lockSchema = {
    dialect: 'vnd.fjs.lock',
    revision: hash,
    parents: array(hash),
    generation: number,
    map: record(hash),
} as const
```

| Field        | Type         | Meaning |
|--------------|--------------|---------|
| `dialect`    | literal      | Format tag. |
| `revision`   | `hash`       | Exact revision for which this lock records subject resolutions. |
| `parents`    | `hash[]`     | Previous lock files in the lock history for the same exact revision. |
| `generation` | `number`     | `0` for an initial lock, otherwise `1 + max(parent.generation)` for conforming writers. |
| `map`        | `record(hash)` | Revision subject to immutable resolution-reference hash. |

As in the revision format, `hash` is structurally a string and semantic
validation checks cbase32 decodability. `generation` must be a non-negative
safe integer. Equality with the generation derived from parents is a writer
rule and an observable history-continuity check, not a condition for detecting
the blob as a lock.

### Resolution-reference semantics

A `map` value is a hash of either:

1. a revision file whose `subject` equals the map key; or
2. another lock file whose `revision` references a revision whose `subject`
   equals the map key.

The second form selects both a revision and its own resolution scope. This is
sufficient for scoped overrides and diamond conflicts without a recursive
inline map type in the first version.

For example:

```text
A -> B
A -> C
B -> D(v1)
C -> D(v2)
```

can be represented as:

```text
lock A
|- B -> lock B
|       `- D -> revision D(v1)
`- C -> lock C
        `- D -> revision D(v2)
```

The logical complete resolution may therefore be a graph of immutable lock
files rather than one physically self-contained file.

Checking that a referenced blob exists, determining whether it is a revision
or lock, and checking the referenced subject require store access. Those are
referential-validation or processing concerns, not part of the pure media
format validator.

### Partial and complete locks

The same format represents both partial and complete locks.

A partial lock may omit subjects needed by a processor. It can be supplied as
an input constraint or override, including a binding to another lock file.

A lock is complete for a processing operation when every subject resolution
required by that operation is available through the lock and transitively
referenced locks, without consulting mutable subject heads.

Processors that resolve revision subjects should return the complete lock used
for their output. Subject discovery, unresolved-subject selection, head choice,
conflict policy, and the algorithm for constructing that complete lock belong
to each processor or to later shared resolution infrastructure; they are not
encoded in this format.

### Lock history is scoped to one exact revision

Every exact revision may have its own independent lock-history DAG:

```text
R0 <- L00 <- L01
R1 <- L10 <- L11
```

`L10` does not name `L01` as a parent. Changing the source revision starts a
new lock history, even if a processor uses an older revision's lock as an
input or optimization while constructing the new one.

This separation allows external dependencies to evolve while source content
remains unchanged. For example, a user may stay on `R0` but upgrade everything
else:

```text
source: R0 -> R1

locks:
R0 <- L00 <- L01
R1 <- L10
```

`L01` is an updated external resolution for the exact same source revision
`R0`.

For every parent edge, the referenced parent lock must have the same exact
`revision` hash as the child lock. Parent order follows the revision precedent:
`parents[0]` is the mainline parent and later entries are merged concurrent
histories.

`parents` records lock history only. Parent maps are never inherited or used as
fallback resolution. A complete lock must remain usable from its own `map` and
explicitly referenced nested locks; previous lock files can be removed from
active consideration.

### Relationship to ecosystem lock files

The first integration can keep ecosystem-specific lock formats as immutable
content referenced through revisions and this universal lock graph. Adapters
may materialize `package-lock.json`, `deno.lock`, `bun.lock`, `Cargo.lock`, or
other native files before invoking their tools.

Replacing native solver-specific data with normalized subject-level entries is
a later adapter concern. This task defines the universal history and reference
infrastructure, not npm, Cargo, Deno, Bun, or Nix resolution semantics.

### Tasks

- [ ] Create `fjs/media/lock/`, mirroring `fjs/media/revision/`: pure rtti
      schema, `dialect`, derived media type, TypeScript type, hash/generation
      checks, decode/validate, and `README.md`.
- [ ] Validate every `revision`, `parents`, and `map` value as a native cbase32
      hash and validate `generation` as a non-negative safe integer.
- [ ] Document the normative field semantics, partial/complete terminology,
      per-revision lock histories, and the distinction between `parents` and
      nested lock references.
- [ ] Add proofs for structural validation, invalid hashes, invalid
      generations, empty and populated maps, and parent ordering preservation.
- [ ] Register the dialect with `fjs/media` detection and derive
      `application/vnd.fjs.lock+json` through the existing dialect convention.
- [ ] Add store-backed referential validation separately: parent locks must
      target the same exact `revision`; each `map` target must be a revision or
      lock resolving the map key's subject.
- [ ] Define a processor-facing contract separately: an optional partial lock
      may constrain resolution, and successful processing that resolves
      subjects returns a complete lock graph sufficient for replay without
      mutable head lookup.

### Out of scope

- A recursive inline map such as `record(hash | nestedMap)`; nested lock files
  already provide scoped overrides in the first version.
- A specific subject-discovery, dependency-solving, head-selection, or merge
  algorithm.
- Inheriting bindings from parent locks.
- Bundling the complete transitive lock/revision/content closure into one
  physical file.
- Ecosystem-specific adapters and generation of native lock files.
- Including compiler versions, platform state, configuration, or all other
  inputs required for fully reproducible builds; those may later be locked as
  ordinary external subjects or described by a separate processing format.

### Related

- [fjs/media/revision/README.md](../revision/README.md) — revision shape,
  parent ordering, generation semantics, dialect convention, and the source
  history that locks intentionally remain separate from
- [fjs/cas/evo/README.md](../../cas/evo/README.md) — revision storage and head
  infrastructure that future lock-history operations may parallel
- [fjs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — media-module placement and dialect naming convention
