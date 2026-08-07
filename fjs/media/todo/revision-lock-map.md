## Revision lock map: staged reproducible subject resolution

**Priority:** P3
**Status:** open

### Problem

A [`vnd.fjs.revision`](../revision/README.md) identifies an immutable snapshot
for one mutable `subject`, but that snapshot may reference other revision
subjects. Resolving those subjects through their current heads makes processing
non-reproducible: the same revision can produce a different result later even
when its own snapshot is unchanged.

The lock map belongs in the revision format because revision content and
revision-subject resolution are closely related. A separate lock-history format
would duplicate the existing revision mechanism (`subject`, `parents`,
`generation`, and `snapshot`).

Implement the lock map in two stages:

1. a flat map from subjects to immutable content hashes;
2. a recursive map that can express scoped conflict resolution.

The first stage should remain small and useful on its own. The second stage
extends the accepted lock values without changing the role of the `lock` field.

### Shared decisions

Both stages follow these rules:

- `lock` is an optional field of `vnd.fjs.revision`;
- a direct string value is an immutable content hash selected for the subject;
- the value is the same kind of content hash carried by `revision.snapshot`,
  not the hash of a revision object;
- `revision` remains the only history representation;
- lock maps contain resolver input, not their own `subject`, `parents`,
  `generation`, or lifecycle;
- resolution algorithms may inspect immutable revision history;
- inheritance, precedence, dependency discovery, conflict handling, and
  head-selection rules belong to resolvers rather than the media format;
- revisions with equal snapshots and different lock maps are valid, and
  applications may present them as source-unchanged dependency updates.

For example:

```text
R0:
    snapshot = S0
    lock = M0

R1:
    parents = [R0]
    snapshot = S0
    lock = M1
```

A dependency-resolution change for an older source state can fork from that
older revision. No second history mechanism is needed.

## Stage 1: flat lock map

### Schema

Start with the non-recursive schema:

```ts
const lock = record(string)
```

Add it as an optional revision field:

```ts
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

Conceptually, the derived TypeScript type is:

```ts
type LockMap = Readonly<Record<string, string>>
```

Every property maps one revision subject to one immutable content hash.

### Direct entries

Example:

```json
{
  "B": "snapshot-hash-of-B",
  "C": "snapshot-hash-of-C"
}
```

Pure validation checks only that the value is a record of strings. Validation
does not load revision objects or require a referenced revision whose `subject`
matches the map key.

The revision itself supplies the starting binding:

```text
revision.subject -> revision.snapshot
```

A same-subject lock entry is structurally valid:

```ts
{
    subject: A,
    snapshot: hashA1,
    lock: {
        A: hashA0,
    },
}
```

The resolver decides whether to ignore it, use it in another context, report an
ambiguity, or apply another deterministic policy.

### Historical resolution

The optional flat map may be absent, sparse, or sufficient for a particular
resolver invocation.

A resolver may look into revision history for missing information. For example,
it may:

- inspect first-parent history;
- inspect several parents and report conflicts;
- combine historical entries with a caller-provided environment;
- consult mutable heads only for unresolved subjects;
- return an updated map containing choices it used or discovered.

Looking into the past does not itself weaken reproducibility because parent
references are immutable hashes. Reproducibility still requires compatible
resolver semantics.

The format must not define absence of a lock entry as either inheritance or
current-head lookup. It only stores the available resolution information.

### Cyclic subject references

Flat lock maps can resolve logical subject cycles without creating
content-addressing cycles because entries select content hashes rather than
revision hashes containing their own lock maps.

For example, while processing A:

```json
{
  "B": "snapshot-hash-of-B",
  "C": "snapshot-hash-of-C"
}
```

combined with the starting binding can produce:

```text
A -> snapshot-hash-of-A
B -> snapshot-hash-of-B
C -> snapshot-hash-of-C
```

This can resolve A and B referring to each other without requiring A's revision
hash inside B or B's revision hash inside A.

### Resolver-relative sufficiency

A flat lock map is not intrinsically partial or complete. Sufficiency depends
on:

- the resolver and its version;
- the starting revision and operation;
- resolver configuration and caller-provided inputs;
- dependencies discovered while examining content.

A map is sufficient for one invocation when that resolver can finish without
making additional unrecorded resolution choices.

### Stage 1 tasks

- [ ] Define `const lock = record(string)` and derive/export its TypeScript
      type.
- [ ] Add optional `lock` to the revision schema, decoder, validator, exported
      type, README shape, and examples.
- [ ] Add proofs for absent, empty, and flat lock maps; invalid values; and
      preservation of entries.
- [ ] Document that direct values select immutable content hashes rather than
      revision hashes.
- [ ] Document that same-subject, missing, extra, and conflicting historical
      entries are structurally valid resolver input rather than format errors.
- [ ] Document that resolvers may inspect immutable revision history without
      prescribing one inheritance or merge algorithm.
- [ ] Add processor-facing follow-up work for accepting an optional flat lock
      and returning an updated flat lock.
- [ ] Add cyclic-reference examples showing that flat content bindings avoid
      revision-hash cycles.
- [ ] Reconcile adding `lock` with the revision dialect versioning rule before
      emitting persistent records.

## Stage 2: recursive lock map

### Schema

After the flat format is implemented and used, extend `lock` to accept nested
maps:

```ts
const lock = () => ['record', or(string, lock)]
```

Conceptually:

```ts
type LockMap = {
    readonly [subject: string]: string | LockMap | undefined
}
```

All Stage 1 flat lock maps remain valid Stage 2 lock maps.

### Nested maps

Nested maps provide scoped resolution information, mainly for incompatible
diamond dependencies or similar conflicts.

Example:

```text
A -> B
A -> C
B -> D(v1)
C -> D(v2)
```

A recursive map can represent both D selections:

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

The media format records the nested information but does not prescribe whether
a nested map overlays its enclosing map, replaces it, inherits selected entries,
or participates in another resolver-specific lookup rule.

Nested maps may be sparse and may omit the subject under which they appear:

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

This is structurally valid. A resolver may interpret it using revision history,
a caller environment, or its own scope policy. If it cannot resolve the
ambiguity, the map is insufficient for that invocation rather than malformed.

Flat maps should remain the normal representation. Nested maps are introduced
only when one flat subject binding cannot express the available scoped choices.

### Stage 2 compatibility

Stage 2 widens the accepted value type from `string` to `string | LockMap`.

New readers can process every Stage 1 record. Stage 1 readers will reject a
revision that contains nested maps rather than silently interpreting those maps
as flat bindings.

Before Stage 2 records are emitted, decide whether widening the existing
revision dialect is permitted by the media compatibility policy or requires a
new dialect/version.

### Stage 2 tasks

- [ ] Replace the flat schema with
      `const lock = () => ['record', or(string, lock)]`.
- [ ] Derive and export the recursive TypeScript index-signature type without
      introducing an invalid circular type alias.
- [ ] Update validation and proofs for nested maps and malformed recursive
      values.
- [ ] Add nested conflict examples and document their resolver-specific
      semantics.
- [ ] Preserve Stage 1 flat examples and prove that all flat lock maps remain
      accepted.
- [ ] Add processor-facing follow-up work for consuming and returning recursive
      maps.
- [ ] Reconcile the recursive extension with the dialect versioning rule before
      emitting nested maps.

### Future shared lock files

A future `vnd.fjs.lock` format may store a reusable, history-free lock map so
large or shared environments do not have to be repeated inline. History for
such content would still use ordinary revisions when needed.

A future extension may also allow the revision's whole `lock` field to reference
shared lock content. This is outside both stages of this TODO.

### Out of scope

- A separate lock/freeze history format with its own parents or generation.
- A mandatory universal dependency-resolution algorithm.
- Format-level precedence, scope inheritance, or conflict-resolution rules.
- Ecosystem-specific npm, Deno, Bun, Cargo, or Nix adapters.
- A shared `vnd.fjs.lock` blob format.
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
