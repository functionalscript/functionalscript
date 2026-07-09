# `evo` — evolution of mutable objects on top of immutable CAS

CAS blobs are immutable and addressed by content hash, so "the same object,
but updated" has no address in common with the old version — a new version is
always a new hash. This module defines a `revision` content format: a BLOB
representing one step in the evolution of a mutable object, linking back to
its parent revision(s). Head resolution, materialization, generation-cache
verification, and a merge-revision constructor live here too, next to the
schema, keeping [`fs/cas/module.f.ts`](../module.f.ts) focused on
hashing/addressing.

## The `revision` schema

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
| `mimeType`   | literal string  | Format tag — see below. |
| `object`     | `ref`           | Identity of the mutable object being revised. |
| `parents`    | `hash[]`        | Parent revision BLOBs. Empty ⇒ first revision. |
| `content`    | `ref?`          | Complete materialized content. Authoritative when present. |
| `changes`    | `ref[]?`        | Incremental changes against the parent(s). Used only when `content` is absent. |
| `generation` | `number?`       | Cached generation number — a cache, not a source of truth. |
| `archived`   | `true?`         | Marks the object archived/inactive. |

## `ref` and `hash`

A `ref` is a URL in content-addressed digital space. Two forms are recognized
today:

- a **cbase32 hash** — a native CAS address (see [`fs/cbase32`](../../cbase32/)),
- a standard **`https://` URL** — a bridge to the legacy location-addressed
  web.

More forms are planned (see "Open design points" below). `hash` is the
hash-only subset of `ref`: a cbase32 CAS address, never a bridge URL. `parents`
uses `hash`, not `ref`, because a parent revision is always a CAS blob — a
bridge URL cannot stand in for it, and **a revision with a non-CAS parent must
not validate**. `fs/cas/evo/module.f.ts` exports `isHash`/`isRef` for this
semantic check (the RTTI schema itself only checks that the field is a
string — RTTI has no "refine" concept) and `parseRevision`, which combines
structural RTTI validation with these checks.

## Object identity

`object` identity normally comes from the first `content`: the hash of the
object's initial content is the object's identity. Two objects created from
identical initial content therefore share an identity — this is by design: it
is fine to have many changes of the same object from different users. When
distinct identity is wanted, a ref can carry an additional nonce
(`{hash}-{nonce}`, not yet implemented). Digital signatures (a separate,
future spec) will filter changes from unknown users.

`object` is also the fallback base for `parents`: a revision with no parents
uses `object` as its base, with or without `changes`.

## The `mimeType` tag

`mimeType` is a self-describing format tag: in a generic CAS a blob is just
bytes under a hash, so without a discriminant a reader can only recognize a
revision by guessing from its shape, which collides with any other format
that happens to have `object`/`parents` fields. The tag gives format
detection (tools can recognize revisions while walking a store) and a cheap
pre-validation gate; the key doubles as the type discriminant.

The value is a media type in the RFC 6838 vendor tree with the RFC 6839
`+json` structured-syntax suffix: the part before `+`
(`vnd.functionalscript.revision`) names the specific format, the suffix tells
generic tooling the underlying syntax is JSON. No registry entry is required
for the vendor tree, the string is stable (no mutable URL, no DNS anchoring),
and it is validated by the schema itself since the literal is part of the
schema.

The key is spelled `mimeType` — the same field name MCP resource contents
use — because CAS objects will be exposed as MCP resources and a server can
surface this value directly as the response `mimeType` (see
[`../mcp/todo/cas-get-mcp-resource-response.md`](../mcp/todo/cas-get-mcp-resource-response.md)).
A stored blob is untrusted input, though: a server must never echo a stored
`mimeType` blindly — only surface it once the blob has been validated against
the schema that tag names (an allowlist of known
`application/vnd.functionalscript.*+json` types, each checked with its own
validator). That MCP-side wiring is tracked separately and not implemented by
this module.

### Versioning rule

Additive, compatible changes keep the tag — RTTI struct validation accepts
undeclared keys by design, so a blob with extra fields still validates
against the v1 schema, and that is the intended forward-compatibility path.
An **incompatible** change MUST NOT reuse the tag: it introduces a new media
type (for example `application/vnd.functionalscript.revision2+json`), so
readers of the old format never validate — and never silently misread — a
blob of the new one. The tag is therefore the version discriminant for
breaking changes; no `version` field is needed.

## Head resolution

`object` gives every revision of the same mutable thing a common anchor to
resolve "current head(s)" against, without requiring a mutable pointer
anywhere in CAS itself. A head is whatever revision(s) reference `object` and
are not listed as a parent by another revision *of the same `object`* — a
revision of a different object referencing the same hash (or an unrelated
blob imported by sync) must not demote a head.

`heads(object)(entries)` implements this as a reverse index scoped per
object: it filters `entries` down to those revising `object`, collects every
hash appearing in one of their `parents` arrays, and returns the ones not
collected. Heads can be demoted retroactively — simply call `heads` again
once a newly synced revision extends the entry set with a same-object child.

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

**First iteration status:** `materialize` in `module.f.ts` implements steps 1
and 3 for zero or one parent. `changes` replay (step 2) is not implemented —
a revision carrying `changes` and no `content` materializes to `undefined`.
A bare multi-parent revision (no `content`) also materializes to `undefined`;
a multi-parent (merge) revision must carry `content`.

## Conflicting concurrent heads

Resolved the same way as in Git: a merge tool creates a new revision that
references the conflicting revisions as `parents`. The format itself does not
resolve conflicts; it records their resolution. CAS synchronization MUST
never care about merge conflicts — an object can legitimately have many heads
in a store at any time. An application can propose a merge revision; sync
just moves blobs.

`merge(resolve)(object)(parents)(content)` builds such a revision: it
requires at least two `parents` (resolving one head is not a merge) and fills
in a `generation` cache from the parents' own cached generations (see below).
The already-resolved `content` — from a 3-way merge tool, a manual pick,
whatever produced the answer — is the caller's responsibility; this function
only records the resolution as CAS data.

`changes` entries will most likely point to an event log, most likely
CRDT-based, but the refs may point to different (not yet defined) formats.

## Generation cache

`generation` is a cache, not a source of truth — it must always be
re-derivable from `parents`, and a consumer must not trust a `generation` it
has not verified against the actual parent chain from an untrusted source.
Normally `generation = 0` for the first revision, `generation = 1 +
max(parent.generation)` otherwise.

Two helpers, deliberately asymmetric in what they trust:

- `cachedGeneration(resolve)(parents)` — cheap, for a producer building a
  *new* revision on top of its own already-trusted history: `1 + max` of each
  parent's own cached `generation` field (defaulting an unresolved/uncached
  parent to `0`).
- `actualGeneration(resolve)(hash)` / `verifyGeneration(resolve)(rev)` —
  recomputes generation by walking the real parent chain, never trusting a
  parent's cached field. This is what a consumer of untrusted (e.g. synced)
  data must run before relying on a cached `generation`.

## `archived`

Marks the mutable object as archived/inactive — for example, a task that is
done. An archived object's blobs can be deleted from a local CAS after a
backup. The field follows the existing `option(true)` idiom (a
presence-only flag) rather than `option(boolean)`, matching the convention
used elsewhere in the RTTI-typed schemas under `fs/types/rtti`. `isArchived`
tests the flag; the revision still exists and is just hidden from normal
active views by whatever consumer implements that view.

## Open design points

- The `changes` event-log/CRDT format(s) still need to be defined (not
  implemented in the first iteration).
- Future `ref` forms beyond cbase32 hashes and `https://` bridge URLs
  (including the optional `{hash}-{nonce}` form for distinct object
  identity), and which ref positions besides `parents` use the hash-only
  `hash` type rather than the general `ref` (`object`? `content`? `changes`?).
- Whether other content formats should share the same `mimeType` tagging
  convention (including its versioning rule).
- The exact syntax of a content-addressed revision reference (e.g.
  `{hash}.{generation}.{hash}` — `hash.generation` alone does not pin a
  version across branches; undefined for now — only hashes are used).
- Digital signatures for filtering changes from unknown users — a separate,
  future spec.
- Further out: a `{public-key}/{name}.{generation}` form, where the key's
  owner defines what `{name}` means (see
  [`../../../todo/plan/vision.md`](../../../todo/plan/vision.md)).
- Surfacing a validated stored `mimeType` as the MCP `cas_get` response
  `mimeType` — see
  [`../mcp/todo/cas-get-mcp-resource-response.md`](../mcp/todo/cas-get-mcp-resource-response.md).

## Related

- [`../todo/revision-content-format.md`](../todo/revision-content-format.md) —
  the design task this module implements.
- [`../../../todo/plan/vision.md`](../../../todo/plan/vision.md) — DISOT
  block types (signature, trust, license, redirect) this format sits
  alongside.
- [`../todo/66g-cas-verify-command.md`](../todo/66g-cas-verify-command.md) —
  integrity checking applies equally to revision BLOBs.
