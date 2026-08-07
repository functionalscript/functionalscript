## Revision lock map: staged reproducible subject resolution

**Priority:** P3
**Status:** open

### Problem

A [`vnd.fjs.revision`](../revision/README.md) identifies an immutable snapshot
for one mutable `subject`, but that snapshot may reference other revision
subjects. Resolving those subjects through current heads makes processing
non-reproducible: the same revision can produce a different result later even
when its own snapshot is unchanged.

The lock map belongs in the revision format because source evolution and
revision-subject resolution are closely related. A separate lock-history format
would duplicate the existing revision mechanism (`subject`, `parents`,
`generation`, and `snapshot`).

Implement the lock map in two stages:

1. a flat map from subjects to immutable content hashes;
2. a recursive map that can express scoped conflict resolution.

The first stage should remain small and independently useful. The second stage
widens the accepted values without changing the role of the `lock` field or the
shape of the Evo API.

### Shared decisions

Both stages follow these rules:

- `lock` is an optional field of `vnd.fjs.revision`;
- a direct string value is an immutable content hash selected for the subject;
- the value is the same kind of content hash carried by `revision.snapshot`,
  not the hash of a revision object;
- `revision` remains the only history representation;
- lock maps are resolver input, not objects with their own `subject`,
  `parents`, `generation`, or lifecycle;
- resolution algorithms may inspect immutable revision history;
- inheritance, precedence, dependency discovery, conflict handling, and
  head-selection rules belong to resolvers rather than the media format;
- revisions with equal snapshots and different lock maps are valid, and
  applications may present them as source-unchanged dependency updates;
- [`fjs/cas/evo`](../../cas/evo/README.md) exposes the same optional lock through
  its existing round-trippable `RevisionData` API rather than introducing a
  separate lock API.

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

### Media schema

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

Conceptually, the derived TypeScript type is an open map whose missing lookups
produce `undefined`:

```ts
type LockMap = StringMap<string>
```

Equivalently:

```ts
type LockMap = {
    readonly [subject: string]: string | undefined
}
```

Every present property maps one revision subject to one immutable content hash.
Do not use `Readonly<Record<string, string>>`, because that incorrectly types
every possible subject lookup as present.

The RTTI shape is only a record of strings because native cBase32 hashes are
structurally strings. The media-level semantic reference check must validate
every direct lock value with the same hash predicate used for `parents` and
`snapshot`. A revision containing a URL, malformed cBase32 value, or another
non-hash string is invalid even when it bypasses Evo and is decoded directly by
`fjs/media/revision`.

### Evo API

Extend the existing shared input/output type:

```ts
type RevisionData = {
    readonly parents: readonly Hash[]
    readonly snapshot?: Hash
    readonly subject?: Subject
    readonly archived?: true
    readonly generation?: number
    readonly lock?: LockMap
}
```

The existing API operations keep their signatures:

```ts
type Evo<O> = {
    list: (archived?: true) => Effect<MemOp, readonly Subject[]>
    head: (subject: Subject) => Effect<MemOp, readonly Hash[]>
    add: (rev: RevisionData) => Effect<O | MemOp, Result<Hash, string>>
    revision: (hash: Hash) => Effect<O | MemOp, Result<RevisionData, string>>
}
```

`add` accepts an optional flat lock and stores it in the revision. `revision`
returns the lock when present. Because `RevisionData` is intentionally the same
vocabulary in both directions, a value returned by `revision` must remain valid
input to `add` without removing or translating the lock.

Media validation rejects invalid direct lock hashes. Evo additionally
canonicalizes every direct lock value before serialization and canonicalizes it
again when reading a revision, using the same cBase32 spelling policy as
`parents` and `snapshot`. Alias spellings therefore do not create different
revisions for the same logical lock map.

An omitted lock remains omitted. An explicitly empty lock remains an empty map;
it is not converted to absence because those values may be interpreted
differently by an application or resolver.

The Evo documentation table should describe `lock` as:

| field  | as input to `add` | as output of `revision` |
|--------|-------------------|-------------------------|
| `lock` | optional flat map; direct hashes validated and canonicalized | optional; present exactly when stored, with canonical direct hashes |

The MCP Evo front end exposes `RevisionData`, so `evo_add` and `evo_revision`
must accept and return the same optional flat lock and test its round trip.

### Direct entries

Example:

```json
{
  "B": "snapshot-hash-of-B",
  "C": "snapshot-hash-of-C"
}
```

Validation does not load revision objects or require a referenced revision whose
`subject` matches the map key. It validates the map structure and every direct
content hash, but the association between the key and the selected content is
resolver input.

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
on the resolver, its version, the starting revision and operation, caller
configuration, and dependencies discovered while processing content.

A map is sufficient for one invocation when that resolver can finish without
making additional unrecorded resolution choices.

### Stage 1 tasks

- [ ] Define `const lock = record(string)` and derive/export `LockMap` as an open
      optional index (`StringMap<string>`), not `Record<string, string>`.
- [ ] Add optional `lock` to the revision schema, decoder, exported type, README
      shape, and examples.
- [ ] Extend media-level semantic reference validation to check every direct
      lock value with the same native cBase32 hash predicate used for `parents`
      and `snapshot`.
- [ ] Extend Evo `RevisionData` with `readonly lock?: LockMap` while preserving
      the shared add/read round-trip type.
- [ ] Make Evo `add` validate, canonicalize, and store the optional flat lock.
- [ ] Make Evo `revision` return the optional lock and canonicalize every direct
      hash value.
- [ ] Preserve the distinction between an absent lock and an empty lock.
- [ ] Update Evo README field guarantees and examples.
- [ ] Update `fjs/mcp/evo` schemas, documentation, and proofs for `evo_add` and
      `evo_revision` lock round trips.
- [ ] Add media proofs for absent, empty, and flat lock maps; malformed values;
      invalid hashes; alias hashes; and preservation of entries.
- [ ] Add Evo proofs for valid, invalid, aliased, empty, and absent lock values.
- [ ] Document that direct values select immutable content hashes rather than
      revision hashes.
- [ ] Document that same-subject, missing, extra, and conflicting historical
      entries are valid resolver input rather than format errors.
- [ ] Document that resolvers may inspect immutable revision history without
      prescribing one inheritance or merge algorithm.
- [ ] Add processor-facing follow-up work for accepting an optional flat lock
      and returning an updated flat lock.
- [ ] Add cyclic-reference examples showing that flat content bindings avoid
      revision-hash cycles.
- [ ] Reconcile adding `lock` with the revision dialect versioning rule before
      emitting persistent records.

## Stage 2: recursive lock map

### Blocked by

- [Recursive RTTI to JSON Schema](../json/todo/rtti-recursive-json-schema.md)
- [RTTI serializable data representation](../../types/rtti/todo/serializable-data.md)

The recursive JSON Schema task is itself blocked by the RTTI serializable data
representation. The current JSON Schema transformer walks thunk RTTI directly
and cannot terminate on a recursive schema such as the Stage 2 lock.

Do not implement or emit Stage 2 recursive lock records until both blockers are
complete. Stage 1 uses only a finite `record(string)` schema and is not blocked
by them.

### Media schema

After the flat format is implemented and the blockers above are complete,
extend `lock` to accept nested maps:

```ts
const lock = () => ['record', or(string, lock)] as const
```

The trailing `as const` is required so TypeScript infers the thunk result as the
readonly discriminated RTTI tuple rather than a mutable array.

Conceptually:

```ts
type LockMap = {
    readonly [subject: string]: string | LockMap | undefined
}
```

All Stage 1 flat lock maps remain valid Stage 2 lock maps.

As in Stage 1, RTTI validates the recursive string/map structure while the
media-level semantic reference check validates every direct string encountered
at any nesting depth as a native cBase32 hash.

### Evo API

The Evo API does not gain another field or operation in Stage 2. Its existing
`RevisionData.lock?: LockMap` widens with the shared `LockMap` type.

`add` validates and canonicalizes direct hashes recursively through all nested
maps before serialization. `revision` recursively canonicalizes all direct
hashes while preserving the exact nested map structure. Flat maps continue to
round-trip unchanged.

The MCP input/output schemas and proofs widen in the same way so nested lock
maps can pass through `evo_add` and `evo_revision` without flattening or losing
scope boundaries.

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

Nested maps may be sparse and may omit the subject under which they appear.
This is structurally valid. A resolver may interpret the map using revision
history, a caller environment, or its own scope policy. If it cannot resolve an
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
      `const lock = () => ['record', or(string, lock)] as const`.
- [ ] Derive and export the recursive TypeScript index-signature type.
- [ ] Update RTTI structural validation and proofs for nested maps and malformed
      recursive values.
- [ ] Recursively validate every direct lock string in the media semantic
      reference checker.
- [ ] Widen Evo `RevisionData.lock` through the shared recursive `LockMap` type.
- [ ] Recursively validate and canonicalize direct lock hashes in Evo `add` and
      `revision` while preserving nested structure.
- [ ] Update Evo and MCP documentation, schemas, and proofs for recursive lock
      round trips using the generated `$defs`/`$ref` JSON Schema.
- [ ] Add nested conflict examples and document their resolver-specific
      semantics.
- [ ] Preserve Stage 1 flat examples and prove that all flat lock maps remain
      accepted by media, Evo, and MCP layers.
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

- [fjs/media/revision/README.md](../revision/README.md) — revision shape,
  generation rules, and dialect versioning policy
- [Recursive RTTI to JSON Schema](../json/todo/rtti-recursive-json-schema.md)
  — direct blocker for Stage 2
- [RTTI serializable data representation](../../types/rtti/todo/serializable-data.md)
  — named or indexed references that make recursive RTTI finite and serializable
- [fjs/cas/evo/README.md](../../cas/evo/README.md) — the round-trippable Evo API
  that must expose the optional lock
- [fjs/mcp/evo/README.md](../../mcp/evo/README.md) — MCP exposure of Evo
- [fjs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — media-module placement and dialect naming conventions
