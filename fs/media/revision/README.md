# `vnd.fjs.revision`

A content format for evolving a mutable object on top of immutable,
content-addressed storage ([`fs/cas`](../../cas/)). A **revision** is a CAS
BLOB representing one step in the evolution of a mutable object — a
document, a config, a piece of mutable state referenced by a stable name. It
links back to its parent revision(s) (a DAG, not just a chain, so concurrent
edits can merge) and carries the full materialized content.

Served as `application/vnd.fjs.revision+json`, derived mechanically from the
`dialect` tag (`application/` + dialect + `+json`).

## Shape

```ts
export const revisionSchema = {
    dialect: 'vnd.fjs.revision',
    subject: string,
    parents: array(string),   // each a cbase32 hash
    snapshot: option(string), // a cbase32 hash
    generation: option(number),
    archived: option(true),
} as const
```

| Field        | Type                    | Meaning |
|--------------|-------------------------|---------|
| `dialect`    | `'vnd.fjs.revision'`    | Format tag; see [Dialect tag](#dialect-tag) below. Must be the first JSON key. |
| `subject`    | `string`                | Identity of the mutable object being revised ("subject" as in the subject of a certificate). Usually any string; it must be a cbase32 hash only when it is used as the fallback snapshot reference (see [Snapshot resolution](#snapshot-resolution)). |
| `parents`    | `readonly string[]`     | Parent revision BLOBs, each a cbase32 hash. An empty array means this is the first revision. |
| `snapshot`   | `string \| undefined`   | Complete materialized content of this revision, as a cbase32 hash. See [Snapshot resolution](#snapshot-resolution) for how it defaults when absent. |
| `generation` | `number \| undefined`   | Cached generation number: `0` for the first revision, `1 + max(parent.generation)` otherwise. A cache, not a source of truth — a consumer must not trust a `generation` it has not verified against the actual parent chain from an untrusted source. |
| `archived`   | `true \| undefined`     | Marks the mutable object as archived/inactive. The revision still exists; it is just hidden from normal active views. Presence-only flag, per the `option(true)` idiom used elsewhere in `fs/types/rtti`-typed schemas. |

`hash` is the only snapshot-reference type this dialect accepts: a cbase32
native CAS address (see [`fs/basen/cbase32`](../../basen/cbase32/)).
Revision blobs do not accept `https://` bridge URLs or any other
location-addressed reference form — `parents` and `snapshot` always validate
as hashes.

## Snapshot resolution

- **`snapshot` present** — it is the reference, regardless of `parents`.
- **`snapshot` absent, zero parents** — `subject` is used as the fallback
  snapshot reference and must itself validate as a hash.
- **`snapshot` absent, exactly one parent** — the parent's snapshot is
  inherited.
- **`snapshot` absent, more than one parent** — invalid: there is no single
  parent snapshot to inherit, and falling back to `subject` would silently
  lose the merge result.

## Dialect tag

`dialect` is a self-describing format tag, and doubles as the type
discriminant. In a generic CAS a blob is just bytes under a hash, so without
a discriminant a reader can only recognize a revision by guessing from its
shape, which collides with any other format that happens to have
`subject`/`parents` fields.

The value is a short dialect name in the RFC 6838 vendor-tree style
(`vnd.fjs.revision`). The media type the blob is served with is derived
mechanically — `application/` + dialect + `+json` — because the
`application/` top level and the RFC 6839 `+json` structured-syntax suffix
are already implied by the file being JSON. Any system that does not know
the dialect still has the correct generic fallback: `application/json`.

**Versioning rule:** additive, compatible changes keep the tag — RTTI struct
validation accepts undeclared keys by design, so a blob with extra fields
still validates against this schema, and that is the intended
forward-compatibility path. An **incompatible** change MUST NOT reuse the
tag: it introduces a new dialect (for example `vnd.fjs.revision2`), so
readers of the old format never validate — and never silently misread — a
blob of the new one. This is why incremental diffs are not part of this
format: an optional `changes` field replayed over `snapshot` would be
*schema*-additive but *semantically* breaking (a v1 reader would still
validate such a blob and materialize the base, silently ignoring the
changes). Incremental changes are therefore a future separate dialect,
`vnd.fjs.change`, served as `application/vnd.fjs.change+json`.

## Tagged-JSON detection convention

`dialect` is the first key of the serialized JSON, so a revision blob always
starts with the byte prefix `{"dialect":"vnd.fjs.revision"`. This lets
`fs/media` detection prefix-match cheaply before attempting the more
expensive full parse + schema validation — see
[`fs/media/type`](../type/) for how this is wired into blob detection, and
[`fs/todo/group-fs-subdirectories-by-concern`](../../todo/group-fs-subdirectories-by-concern.md)
for why the pure format lives here rather than under `fs/cas` (detection
must import the schema without creating a `cas` ↔ detector cycle).

## Usage

```ts
import { decodeRevision, encodeRevision, validateRevision, dialect, mediaType } from './module.f.ts'

decodeRevision('{"dialect":"vnd.fjs.revision","subject":"<hash>","parents":[]}')
// ['ok', { dialect: 'vnd.fjs.revision', subject: '<hash>', parents: [] }]

validateRevision({ dialect, subject: 'my-doc', parents: ['<parentHash>'] })
// ['ok', ...] — a single parent, so the parent's snapshot is inherited

encodeRevision(revision) // => JSON text, `dialect` always serialized first
```

## Out of scope (this issue)

- Store-touching evolution operations — head resolution, materialization,
  per-object reverse indexes — stay under `fs/cas`, which imports this
  format rather than the other way around.
- The incremental-change dialect `vnd.fjs.change`.
- Non-hash snapshot-reference forms and content-addressed revision reference
  syntax (e.g. `{hash}.{generation}.{hash}`).
- Digital signatures for filtering changes from unknown users.
