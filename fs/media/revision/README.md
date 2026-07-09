# `revision` content format

Spec for `application/vnd.functionalscript.revision+json` — a BLOB format that
represents one step in the evolution of a mutable object on top of an
immutable content-addressable store ([`fs/cas`](../../cas/)).

A CAS blob is immutable and addressed by content hash, so "the same object,
but updated" cannot be represented directly — every new version is
unavoidably a new hash with no address in common with the old one. A
`revision` blob links back to its parent revision(s) — a DAG, not just a
chain, so concurrent edits can merge — and carries either the full
materialized content or an incremental diff against the parent(s).

This module (`fs/media/revision`) is the pure format only: the RTTI schema,
the `mimeType` constant, and semantic decoding. It has no store access and no
effects. The store-touching operations that use this format — head
resolution, materialization — live in
[`fs/cas/evo`](../../cas/evo/module.f.ts), which depends on this module and
on `fs/cas` itself. The split keeps the dependency graph acyclic: media-type
detection has to import this schema to recognize revision blobs, and
`fs/cas/mcp` already depends on the detector, so a format defined inside
`fs/cas` would close a `cas` ↔ detector cycle.

## Schema

```ts
export const revision = {
    mimeType: 'application/vnd.functionalscript.revision+json',
    object: ref,
    parents: array(hash),
    content: option(ref),
    changes: option(array(ref)),
    generation: option(number),
    archived: option(true),
} as const
```

| Field        | Type            | Meaning |
|--------------|-----------------|---------|
| `mimeType`   | literal          | Format tag and type discriminant (see below). |
| `object`     | `ref`            | Identity of the mutable object being revised. |
| `parents`    | `hash[]`         | Parent revision BLOBs. `[]` means this is the first revision. |
| `content`    | `ref?`           | Complete materialized content of this revision. Authoritative when present. |
| `changes`    | `ref[]?`         | Incremental changes, used only when `content` is absent. |
| `generation` | `number?`        | Cached evolution generation — a re-derivable hint, not a source of truth. |
| `archived`   | `true?`          | Marks the object archived/inactive; the revision itself still exists. |

### `ref` and `hash`

A `ref` is a URL in content-addressed digital space. Two forms are recognized
today: a cbase32 hash (a native CAS address, see
[`fs/basen/cbase32/`](../../basen/cbase32/)), and a standard `https://` URL as
a bridge to the legacy location-addressed web. More forms are planned (see
Open design points). `hash` is the hash-only subset of `ref` used where a
non-CAS reference must never validate — `parents` is one: a parent revision
is itself a CAS blob, so a bridge URL cannot stand in for it.

`isHash`, `isHttpsRef`, and `isRef` implement these checks; `decodeRevision`
runs the rtti shape check (`validate(revision)`) and then these semantic
checks together, since rtti alone can only describe `string`, not "a cbase32
hash or an `https://` URL."

## `mimeType`: format tag and versioning rule

In a generic CAS a blob is just bytes under a hash, so without a discriminant
a reader can only recognize a revision by guessing from its shape — which
collides with any other format that happens to have `object`/`parents`
fields. `mimeType` gives format detection (a tool can recognize revisions
while walking a store) and a cheap pre-validation gate; the key doubles as
the type discriminant.

The value is a media type in the RFC 6838 vendor tree with the RFC 6839
`+json` structured-syntax suffix: `vnd.functionalscript.revision` names the
specific format, `+json` tells generic tooling the underlying syntax is JSON.
No registry entry is required for the vendor tree; the string is stable (no
mutable URL, no DNS anchoring); and it is validated by the schema itself,
since the literal is part of the schema.

**Versioning rule:** additive, compatible changes keep the tag — rtti struct
validation accepts undeclared keys by design, so a blob with extra fields
still validates against this schema, and that is the intended
forward-compatibility path. An **incompatible** change MUST NOT reuse the
tag: it introduces a new media type (e.g.
`application/vnd.functionalscript.revision2+json`), so readers of the old
format never validate — and never silently misread — a blob of the new one.
The tag is therefore the version discriminant for breaking changes; no
`version` field is needed.

The key is spelled `mimeType` — the same field name MCP resource contents
use — because CAS objects are exposed as MCP resources and the server can
surface this value directly. See
[`fs/cas/mcp/todo/cas-get-mcp-resource-response.md`](../../cas/mcp/todo/cas-get-mcp-resource-response.md)
for the (not yet implemented) allowlist + schema-validate rule a server must
follow before ever echoing a stored `mimeType` back to a client.

## `object`: identity and head resolution

`object` gives every revision of the same mutable thing a common anchor to
resolve "current head(s)" against, without requiring a mutable pointer
anywhere in CAS itself. The head is whatever revision(s) reference `object`
and are not listed as a parent by another revision *of the same `object`* —
a revision of a *different* object referencing the same hash (or an
unrelated blob) must not demote a head. See
[`fs/cas/evo`](../../cas/evo/module.f.ts) `heads`.

`object` identity normally comes from the first `content`: the hash of the
object's initial content is the object's identity. Two objects created from
identical initial content therefore share an identity — this is by design:
it is fine to have many changes of the same object from different users.
When distinct identity is wanted, a ref can carry an additional nonce
(`{hash}-{nonce}`, not yet implemented). Digital signatures (a separate,
future spec) will filter changes from unknown users.

`object` is also the fallback base for `parents` in all cases: a revision
with no parents uses `object` as its base, with or without `changes`.

`parents` is an array (not a single value) to support merges — multiple
concurrent lines of history converging, matching the "multi-device /
multi-user, merge freely" model in
[`todo/plan/vision.md`](../../../todo/plan/vision.md).

## Materialization algorithm

`content` has priority; the fields are not mutually exclusive by schema —
resolution is by precedence. The base of a revision is its materialized
parent, or `object` itself when `parents` is empty (in all cases, with or
without `changes`):

1. if `content` is present, use it;
2. otherwise, apply `changes` on the base;
3. otherwise (no `changes`), use the base.

Materialization through multiple parents is only defined when every path
references a single common ancestor, the intermediate revisions have no
`content`, and all `changes` are CRDTs (so application is order-independent).

**First iteration** ([`fs/cas/evo`](../../cas/evo/module.f.ts)
`materialize`) does not implement `changes` at all, so it requires zero or
one parent; a multi-parent (merge) revision must carry `content`.

## Conflicting concurrent heads

Resolved the same way as in Git: a merge tool creates a new revision that
references the conflicting revisions as `parents`, with `content`. The
format itself does not resolve conflicts; it records their resolution. CAS
synchronization MUST never care about merge conflicts — an object can
legitimately have many heads in a store at any time. An application can
propose a merge revision; sync just moves blobs.

## `generation`

A cache, not a source of truth — it must always be re-derivable from
`parents` (`0` for the first revision, otherwise `1 + max(parent.generation)`),
and a consumer must not trust a `generation` it has not verified against the
actual parent chain from an untrusted source. See `computeGeneration` in
[`fs/cas/evo`](../../cas/evo/module.f.ts).

## `archived`

Signals that we no longer work with the object — for example, a task that is
done. An archived object's blobs can be deleted from a local CAS after a
backup. The field follows the existing `option(true)` idiom (a presence-only
flag) rather than `option(boolean)`, matching the convention already used
elsewhere in the rtti-typed schemas under `fs/types/rtti`.

## Open design points

- The `changes` event-log/CRDT format(s) still need to be defined (not
  implemented yet).
- Future `ref` forms beyond cbase32 hashes and `https://` bridge URLs
  (including the optional `{hash}-{nonce}` form for distinct object
  identity), and which ref positions besides `parents` should use the
  hash-only `hash` type rather than the general `ref`.
- Whether other content formats should share the same `mimeType` tagging
  convention (including its versioning rule).
- The exact syntax of a content-addressed revision reference (e.g.
  `{hash}.{generation}.{hash}` — `hash.generation` alone does not pin a
  version across branches; undefined for now — only hashes are used).
- Digital signatures for filtering changes from unknown users — a separate,
  future spec.
- Further out: a `{public-key}/{name}.{generation}` form, where the key's
  owner defines what `{name}` means, tying format identity to the web of
  trust (`vision.md`'s `~/Alice/...` relative-path model).
