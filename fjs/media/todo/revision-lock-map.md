## Revision lock map: staged reproducible subject resolution

**Priority:** P3
**Status:** open

### Problem

A [`vnd.fjs.revision`](../revision/README.md) identifies an immutable snapshot for
one mutable `subject`, but that snapshot may reference other subjects. Resolving
those subjects through current heads makes processing non-reproducible.

The lock map belongs in the revision format because source evolution and subject
resolution share the same history. A separate lock-history format would duplicate
`subject`, `parents`, `generation`, and `snapshot`.

Implement the lock map in two stages:

1. a flat map from subjects to immutable content hashes;
2. a recursive map for scoped conflict resolution.

### Shared decisions

- `lock` is optional resolver input stored on a revision.
- A direct string value selects immutable content, like `revision.snapshot`; it
  is not a revision-object hash.
- Object property order has no semantic meaning.
- All revision JSON is serialized canonically by recursively sorting every object
  property name lexicographically.
- Arrays preserve their declared order.
- `revision` remains the only history representation.
- Lock maps are resolver input, not objects with their own lifecycle.
- Resolvers may inspect immutable revision ancestry.
- Inheritance, precedence, dependency discovery, conflict handling, and mutable
  head fallback belong to resolvers, not the media format.
- Equal snapshots with different lock maps are valid dependency-only updates.
- [`fjs/cas/evo`](../../cas/evo/README.md) exposes the same optional lock through
  its existing round-trippable `RevisionData` type.

A dependency-resolution change for an old source state forks from that old
revision. No second history mechanism is needed.

## Canonical JSON serialization

Parsing JSON already discards source formatting, whitespace, escape spelling,
and the significance of object-property order. Writers must not preserve an
arbitrary JavaScript construction order after that information has been lost.

Use the existing recursive JSON serializer with lexicographically sorted object
entries:

```ts
import { stringify } from '../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'

const toJson = stringify(sort)
```

`serialize` applies its entry mapper to every object recursively, so this one
rule normalizes:

- the top-level revision object;
- Stage 1 flat lock maps;
- Stage 2 nested lock maps;
- any other nested JSON object added later.

Property names are compared as strings using the repository's ordinary string
comparison. Numeric-looking names are not numbers: for example, `"10"` sorts
before `"2"`. Arrays are not reordered.

Do not use JavaScript property-enumeration order and do not reconstruct an object
in a desired insertion order. Serialization sorts the entry list directly.

Two parsed JSON values with the same structure and values must serialize to the
same bytes regardless of their source text or object construction order.
Existing non-canonical blobs remain valid input, but parsing and serializing them
produces the canonical representation and may therefore produce a different CAS
hash. That normalization is intentional.

This serialization change does not require a new dialect because it does not
change the parsed revision value or field semantics.

## Stage 1: flat lock map

### Dialect compatibility

Stage 1 keeps the existing `vnd.fjs.revision` dialect.

The new field is additive and optional. Its absence has the constant meaning
“no lock bindings were recorded”; no existing revision field is reinterpreted
and no value must be inferred from other data.

Older readers may ignore `lock` and continue their existing behavior. They do not
gain lock-aware reproducibility, but they do not misread `subject`, `parents`,
`snapshot`, `generation`, or `archived`.

Lock-aware resolution is an additional capability used by consumers that know
the field. The presence of a lock does not change an existing algorithm that
does not accept lock input. Therefore Stage 1 follows the additive compatibility
path and does not introduce `vnd.fjs.revision2`.

### Media schema

Start with:

```ts
const lock = record(string)
```

Add it to the existing revision schema:

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

The derived TypeScript type is an open map:

```ts
type LockMap = StringMap<string>
```

Equivalently:

```ts
type LockMap = {
    readonly [subject: string]: string | undefined
}
```

Do not use `Readonly<Record<string, string>>`; missing subjects must be typed as
`undefined`.

RTTI validates only the record-of-strings shape. The media-level semantic
reference check must validate every direct lock value with the same native
cBase32 hash predicate used for `parents` and `snapshot`. URLs, malformed hashes,
and other arbitrary strings are invalid even when a revision bypasses Evo.

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

The Evo operations keep their signatures:

```ts
type Evo<O> = {
    list: (archived?: true) => Effect<MemOp, readonly Subject[]>
    head: (subject: Subject) => Effect<MemOp, readonly Hash[]>
    add: (rev: RevisionData) => Effect<O | MemOp, Result<Hash, string>>
    revision: (hash: Hash) => Effect<O | MemOp, Result<RevisionData, string>>
}
```

`add` validates and canonicalizes direct lock hashes before writing.
`revision` returns the stored optional lock with canonical direct hashes. A value
returned by `revision` remains valid input to `add`.

An omitted lock remains omitted. An explicit empty lock remains `{}`.

The Evo README field table should describe `lock` as:

| field | input to `add` | output of `revision` |
|---|---|---|
| `lock` | optional flat open map; direct hashes validated and canonicalized | optional; present exactly when stored; direct hashes canonicalized |

The MCP Evo front end exposes `RevisionData`, so `evo_add` and `evo_revision`
must accept and return the same optional flat lock.

### Resolver behavior

The map may be absent, sparse, or sufficient only for a particular resolver
invocation. A resolver may inspect first-parent history, inspect several parents
and report conflicts, combine history with caller input, or consult mutable heads
for unresolved subjects.

The format does not define a missing entry as inheritance or head lookup. It
stores only the available resolution information.

The revision supplies the starting binding:

```text
revision.subject -> revision.snapshot
```

A same-subject lock entry is structurally valid. Resolver semantics decide how
to interpret it.

Flat maps can also resolve logical dependency cycles without revision-hash
cycles because entries select content hashes rather than revisions containing
other lock maps.

### Stage 1 tasks

- [ ] Change revision writing from `stringify(identity)` to `stringify(sort)`.
- [ ] Document that every revision object is recursively serialized with
      lexicographically sorted property names.
- [ ] Define `const lock = record(string)` and export `LockMap` as
      `StringMap<string>`.
- [ ] Add optional `lock` to the revision schema, decoder, exported type,
      README, and examples.
- [ ] Extend media semantic reference validation to check every direct lock
      value as a native cBase32 hash.
- [ ] Extend Evo `RevisionData` with `readonly lock?: LockMap`.
- [ ] Make Evo `add` validate and canonicalize direct lock hashes.
- [ ] Make Evo `revision` return the optional lock with canonical hashes.
- [ ] Preserve the distinction between absent and empty locks.
- [ ] Update Evo and MCP documentation, schemas, and proofs.
- [ ] Add media proofs for absent, empty, valid, malformed, invalid-hash, and
      alias-hash lock maps.
- [ ] Add Evo round-trip proofs for absent, empty, valid, invalid, and aliased
      lock values.
- [ ] Add proofs that equivalent revisions with differently ordered top-level,
      lock, and other nested object properties produce identical bytes and CAS
      hashes.
- [ ] Add proofs that numeric-looking property names such as `"10"` and `"2"`
      are sorted lexicographically as strings.
- [ ] Add proofs that array order is preserved.
- [ ] Add processor-facing follow-up work for accepting and returning flat lock
      maps.

## Stage 2: recursive lock map

### Blocked by

- [Stage 1 flat lock map](#stage-1-flat-lock-map)
- [Recursive RTTI to JSON Schema](../json/todo/rtti-recursive-json-schema.md)
- [RTTI serializable data representation](../../types/rtti/todo/serializable-data.md)

The recursive JSON Schema task is itself blocked by the RTTI serializable-data
task. Stage 2 must not be emitted until Stage 1 and both recursive RTTI tasks are
complete.

### Media schema

After the blockers are complete, widen the schema:

```ts
const lock = () => ['record', or(string, lock)] as const
```

The trailing `as const` is required for the readonly discriminated RTTI tuple.

Conceptually:

```ts
type LockMap = {
    readonly [subject: string]: string | LockMap | undefined
}
```

Every Stage 1 map remains valid.

RTTI validates the recursive string/map structure. The media semantic reference
checker validates every direct string at every depth as a native cBase32 hash.

### Evo and serialization

The Evo API gains no new field or operation. `RevisionData.lock` widens through
the shared recursive `LockMap` type.

`add` and `revision` recursively validate and canonicalize direct hashes while
preserving nested scope structure.

The existing `stringify(sort)` rule already sorts every nested lock object.
Stage 2 needs no serialization API or special-case logic.

Equivalent recursive maps that differ only in object-property order produce
identical revision bytes and CAS hashes.

### Nested maps

Nested maps express scoped choices, mainly for incompatible diamond dependencies:

```text
A -> B
A -> C
B -> D(v1)
C -> D(v2)
```

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

The format records nested information but does not define overlay, replacement,
inheritance, or lookup semantics. Nested maps may be sparse and may omit the
subject under which they appear.

Flat maps remain the normal representation. Use nesting only when one flat
binding cannot express the available scoped choices.

### Compatibility

Stage 2 widens the declared `lock` values from `string` to `string | LockMap`.
New readers accept all Stage 1 records, while Stage 1 readers that validate the
known `lock` field reject nested maps.

Decide whether Stage 2 keeps the revision dialect or introduces a new version
before emitting recursive lock records. This decision is separate from the
Stage 1 additive-field decision.

### Stage 2 tasks

- [ ] Complete every item under **Blocked by**.
- [ ] Decide the Stage 2 dialect before emitting recursive lock records.
- [ ] Replace the flat schema with
      `const lock = () => ['record', or(string, lock)] as const`.
- [ ] Export the recursive open-map TypeScript type.
- [ ] Add RTTI validation and proofs for nested and malformed maps.
- [ ] Recursively validate every direct lock value in media semantic reference
      checking.
- [ ] Widen Evo and MCP schemas through the shared recursive `LockMap` type.
- [ ] Recursively canonicalize direct hashes in Evo `add` and `revision`.
- [ ] Add proofs for reordered root and nested lock keys, including
      numeric-looking subjects.
- [ ] Add nested conflict examples and document resolver-specific semantics.
- [ ] Preserve and prove Stage 1 compatibility.
- [ ] Add processor-facing follow-up work for recursive maps.

### Future shared lock files

A future `vnd.fjs.lock` format may store a reusable, history-free map. History
for that content would still use ordinary revisions. A future revision may also
reference shared lock content. Both are outside this TODO.

### Out of scope

- A separate lock/freeze history format.
- A mandatory universal dependency-resolution algorithm.
- Format-level precedence, inheritance, or conflict rules.
- Ecosystem-specific npm, Deno, Bun, Cargo, or Nix adapters.
- Full build reproducibility beyond subject-to-content resolution.

### Related

- [Revision format](../revision/README.md)
- [Recursive RTTI to JSON Schema](../json/todo/rtti-recursive-json-schema.md)
- [RTTI serializable data representation](../../types/rtti/todo/serializable-data.md)
- [Evo API](../../cas/evo/README.md)
- [MCP Evo](../../mcp/evo/README.md)
