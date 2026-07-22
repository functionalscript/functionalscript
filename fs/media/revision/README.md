# `vnd.fjs.revision`

A `revision` BLOB is one step in the evolution of a mutable object on top of
an immutable content-addressable store ([`fs/cas`](../../cas/)). CAS blobs
are addressed by content hash, so "the same object, but updated" is
unavoidably a new hash with no address in common with the old one. A
`revision` gives a chain — really a DAG, so concurrent edits can merge — of
updates to one logical mutable object a shared shape, without any mutable
pointer anywhere in the store itself.

```ts
import { revisionSchema, dialect, mediaType, validate, decodeText } from './module.f.ts'
```

## Shape

```ts
export const revisionSchema = {
    dialect: 'vnd.fjs.revision',
    subject: string,
    parents: array(hash),
    snapshot: option(hash),
    generation: option(number),
    archived: option(true),
} as const
```

| Field        | Type                    | Meaning                                                              |
|--------------|-------------------------|------------------------------------------------------------------------|
| `dialect`    | `'vnd.fjs.revision'`    | Format tag — see [Media type](#media-type-and-dialect-tag) below.      |
| `subject`    | `string`                | Identity of the mutable object this revision revises.                  |
| `parents`    | `hash[]`                | Parent revision BLOBs, mainline (first-parent) first — see below. `[]` means this is the first revision. |
| `snapshot`   | `hash` (optional)       | Complete materialized content of this revision.                        |
| `generation` | `number` (optional)     | Cached generation number — `0` for the first revision, else `1 + max(parent.generation)`. |
| `archived`   | `true` (optional)       | Marks the mutable object as archived/inactive.                         |

`hash` is a cbase32 native CAS address ([`fs/basen/cbase32`](../../basen/cbase32/)).
It is the only snapshot-reference type this dialect accepts: `parents` and
`snapshot` always validate as hashes — never `https://` bridge URLs or any
other location-addressed reference form. `subject` is an identity string, not
necessarily a snapshot reference, and validates as a hash only when it is
used as the fallback snapshot reference (see below).

Because rtti struct schemas can't express string-content refinements, `hash`
is `string` at the schema level; cbase32 decodability (and the rejection of
non-cbase32 strings such as `https://` URLs) is enforced by `isHash` /
`validate`, layered on top of the structural schema.

## Snapshot resolution

`snapshot` is the complete materialized content, but it can be omitted and
inherited:

- **Absent, zero parents** — `subject` is used as the fallback snapshot
  reference and must itself validate as a hash.
- **Absent, exactly one parent** — the parent's snapshot is inherited.
- **Absent, more than one parent** — invalid. There is no single parent
  snapshot to inherit, and falling back to `subject` would silently lose the
  merge result.
- **Present** — used as-is, regardless of parent count.

`validate` / `decodeText` enforce this after structural validation succeeds.

## Media type and dialect tag

`dialect` is a self-describing format tag: in a generic CAS, a blob is just
bytes under a hash, so without a discriminant a reader can only recognize a
revision by guessing from its shape, which collides with any other format
that happens to have `subject`/`parents` fields. The tag doubles as the
schema-dispatch key. Its value is a short dialect name in the RFC 6838
vendor-tree style; the media type the blob is served with is derived
mechanically — `application/` + dialect + `+json` — because the
`application/` top level and the RFC 6839 `+json` structured-syntax suffix
are already implied by the file being JSON:

```
dialect:   vnd.fjs.revision
mediaType: application/vnd.fjs.revision+json
```

No registry entry is required for the vendor tree; the string is stable, and
it is validated by the schema itself since the literal is part of the schema.

**Versioning rule:** additive, compatible changes keep the tag — rtti struct
validation accepts undeclared keys by design, so a blob with extra fields
still validates against this schema, and that is the intended
forward-compatibility path. An **incompatible** change must not reuse the
tag: it introduces a new dialect (e.g. `vnd.fjs.revision2`), so readers of the
old format never validate — and never silently misread — a blob of the new
one. This is why incremental diffs are not a field here: an optional
`changes` field would be schema-additive but semantically breaking (a v1
reader would still validate such a blob and materialize the base, silently
ignoring the changes). Incremental changes are a future separate dialect,
`vnd.fjs.change`, served as `application/vnd.fjs.change+json`.

## Tagged-JSON detection

Detection is semantic, not syntactic: [`fs/media`](../../media/) parses the
JSON and validates the parsed value against this schema — any JSON that
satisfies it is a revision, regardless of key order, whitespace, or any other
serialization detail. There is no byte-level shortcut (no assumption about
key order, no `{"dialect":` prefix). JSON that fails to parse, or parses but
doesn't validate against this schema (including a wrong `dialect` value),
falls through to the ordinary detector.

The one practical limit is size: schema validation requires the blob to
already be a buffered `Vec` (`fs/types/bit_vec`), so it is attempted only on
a size-bounded path such as the existing 128 KiB inline-content cap. Larger
blobs fall back to the existing streaming detector, so metadata-only reads
stay size-independent. That is an implementation limit of today's buffering
parser, not part of the format.

## Heads, merges, and archiving

`subject` gives every revision of the same mutable object a common anchor:
the head(s) are whatever revision(s) reference `subject` and are not listed
as a parent by another revision *of the same `subject`* — a revision of a
*different* subject that happens to reference the same hash must not demote
a head. Concurrent heads are resolved the same way as in Git: a merge tool
creates a new revision listing the conflicting revisions as `parents`. The
format only records conflict resolution; it never resolves conflicts itself,
and CAS synchronization never needs to care — a subject can legitimately have
many heads in a store at any time.

Parent *order* is significant: `parents[0]` is the **mainline** parent — the
branch this revision landed on, in the sense of Git's first-parent link. A
merge tool merging branch B into branch A lists A's head first, then B's.
Walking only first parents from a head therefore yields that head's mainline
history, with every later `parents` entry marking a branch that merged in —
this is the walk the planned history API performs
([`fs/cas/evo/todo/subject-history.md`](../../cas/evo/todo/subject-history.md)).
Reordering `parents` changes the meaning of a revision (which branch the
merge landed on), not just its serialization.

`generation` is a cache, not a source of truth: it must always be
re-derivable from `parents`, and a consumer must not trust a `generation` it
has not verified against the actual parent chain from an untrusted source.

`archived` marks a mutable object as no longer worked on (e.g. a finished
task); its blobs can be deleted from a local CAS after a backup. It follows
the existing `option(true)` idiom (a presence-only flag) rather than
`option(boolean)`.

## Out of scope (this module)

- Store-touching evolution operations — head resolution, materialization,
  per-object reverse indexes — are a separate, deferred concern. This module
  is the pure format and its schema/detection only.
- The incremental-change dialect `vnd.fjs.change` (event log, likely
  CRDT-based) and how it links to revisions — a future, separate dialect.
- Snapshot-reference forms beyond cbase32 hashes, and digital signatures for
  filtering changes from unknown users — future, separate specs.
