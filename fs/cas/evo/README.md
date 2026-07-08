# `revision`: evolving mutable objects on top of the immutable CAS

This is the format spec the `evolution` tag in a `revision` BLOB points to
(`https://functionalscript.com/fs/cas/evo/README.md`). It is deployed
automatically to functionalscript.com because it lives in the repo, so the
tag URL dereferences to this document.

CAS blobs are immutable and addressed by content hash: there is no way to
represent "the same object, but updated" directly, since a new version is
unavoidably a new hash with no address in common with the old one. `revision`
gives a chain of updates to one logical (mutable) object — a document, a
config, any piece of state referenced by a stable name — a shared shape: it
links back to its parent revision(s) as a DAG (not just a chain, so concurrent
edits can merge), and carries either the full materialized content or an
incremental diff against the parent(s).

The implementation lives in [`fs/cas/evo/module.f.ts`](module.f.ts) (the RTTI
schema, head resolution, materialization, generation-cache verification, and a
merge-revision builder); this document is the format's authoritative spec.

## Shape

```ts
export const revision = {
    evolution: 'https://functionalscript.com/fs/cas/evo/README.md',
    object: ref,
    parents: array(hash),
    content: option(ref),
    changes: option(array(ref)),
    generation: option(number),
    archived: option(true),
} as const
```

- **`evolution`** — format tag. Key = type discriminant; value is the URL of
  this spec for now, later a hash of the spec. In a generic CAS a blob is just
  bytes under a hash, so without a discriminant a reader can only recognize a
  revision by guessing from its shape, which collides with any other format
  that happens to have `object`/`parents` fields. The tag gives format
  detection, versioning (readers reject or migrate blobs of an incompatible
  version instead of silently misreading them), and a cheap pre-validation
  gate.

  The value is hard-coded as a literal for now — the XML-namespace/JSON-LD
  approach: globally unique without a registry, self-documenting, and
  validated by the schema itself since the literal is part of the schema.
  Later versions of the format migrate the value to a content-addressed
  revision reference: this spec is itself a mutable object evolved by this
  very format, so the reference would combine the spec's object identity with
  a version pin — stable identity across versions, pinned version per blob, no
  registry. The exact reference syntax is not defined yet (`hash.generation`
  alone does not pin a version across branches; something like
  `{hash}.{generation}.{hash}` may be needed) — for now only hashes are used.
  Two costs of the interim URL, accepted knowingly and fixed by that
  migration: the URL is a mutable pointer (the document behind it can
  change), so the value identifies the format but not its version; and it
  anchors the identifier to DNS.

  Note that `evolution`'s value is itself a `ref` under the definition below
  — an `https://` bridge URL today, a CA reference later — so the tag's
  migration path is just the general evolution of `ref`, not a special case.

- **`object`** — identity of the mutable object being revised. Every revision
  of the same mutable thing shares this anchor, which is what "current
  head(s)" is resolved against, without requiring a mutable pointer anywhere
  in CAS itself: the head is whatever revision(s) reference `object` and are
  not listed as a parent by another revision *of the same `object`* — a
  revision of a different object referencing the same hash (or an unrelated
  blob imported by sync) must not demote a head.

  `object` identity normally comes from the first `content`: the hash of the
  object's initial content is the object's identity. Two objects created from
  identical initial content therefore share an identity — this is by design:
  it is fine to have many changes of the same object from different users.
  When distinct identity is wanted, a ref can carry an additional nonce
  (`{hash}-{nonce}`). Digital signatures (a separate, future spec) will filter
  changes from unknown users.

  `object` is also the fallback base for `parents`: a revision with no
  parents uses `object` as its base, with or without `changes` (see
  Materialization below).

- **`parents`** — parent revision BLOBs (an array, to support merges: multiple
  concurrent lines of history converging). Empty means this is the first
  revision. `hash` (not the general `ref`) because a parent is a CAS blob, so
  a bridge URL cannot stand in for it — a revision with a non-CAS parent must
  not validate.

- **`content`** — complete materialized content of this revision. If present,
  it is authoritative and `changes` does not need to be replayed.

- **`changes`** — incremental changes introduced by this revision, used only
  when `content` is absent. Entries will most likely point to an event log,
  most likely CRDT-based, but the refs may point to different (not yet
  defined) formats. **Not implemented in the first iteration** — see below.

- **`generation`** — optional cached generation number within the object's
  evolution. Normally `generation = 0` for the first revision, and
  `generation = 1 + max(parent.generation)` otherwise. It is a cache, not a
  source of truth: it must always be re-derivable from `parents`, and a
  consumer must not trust a `generation` it has not verified against the
  actual parent chain from an untrusted source.

- **`archived`** — marks the mutable object as archived/inactive. The
  revision still exists; it is just hidden from normal active views. An
  archived object's blobs can be deleted from a local CAS after a backup.
  `option(true)` (a presence-only flag) rather than `option(boolean)`,
  matching the convention used elsewhere in the RTTI-typed schemas under
  `fs/types/rtti`.

## `ref` and `hash`

`ref` is a URL in content-addressed digital space. Two forms are recognized
for now: a cbase32 hash (a native CAS address, see [`fs/cbase32/`](../../cbase32/)),
and a standard `https://` URL as a bridge to the legacy location-addressed
web. More forms are planned. `hash` is the hash-only subset of `ref` used in
schema positions restricted to CAS blobs (`parents`).

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

**The first iteration does not implement `changes` at all**, so it only
supports zero or one parent; a multi-parent (merge) revision must carry
`content`, and a `changes`-only revision (no `content`) is reported as an
error rather than silently misapplied.

## Conflicting concurrent heads

Resolved the same way as in Git: a merge tool creates a new revision that
references the conflicting revisions as `parents`. The format itself does not
resolve conflicts; it records their resolution. CAS synchronization MUST
never care about merge conflicts — an object can legitimately have many heads
in a store at any time. An application can propose a merge revision; sync
just moves blobs.

## Open design points

- The `changes` event-log/CRDT format(s) still need to be defined.
- Future `ref` forms beyond cbase32 hashes and `https://` bridge URLs
  (including the optional `{hash}-{nonce}` form for distinct object identity),
  and which ref positions besides `parents` use the hash-only `hash` type
  rather than the general `ref`.
- Whether other content formats should share the same tagging convention, and
  the exact syntax of the future CA revision reference (e.g.
  `{hash}.{generation}.{hash}`; undefined for now — only hashes are used).
- Digital signatures for filtering changes from unknown users — a separate,
  future spec.
- Further out: a `{public-key}/{name}.{generation}` form, where the key's
  owner defines what `{name}` means — anchoring the identifier in a signer
  ties format identity to a web of trust and solves the
  many-generations-from-many-users problem.
