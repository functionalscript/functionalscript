## Revision content format: evolve mutable objects on top of immutable CAS

**Priority:** P3
**Status:** open

### Problem

CAS blobs are immutable and addressed by content hash, so there is no way to represent
"the same object, but updated" directly — a new version of anything is unavoidably a new
hash with no address in common with the old one. Nothing in the store currently defines
how a chain of updates to one logical (mutable) object — a document, a config, a piece of
mutable state referenced by a stable name — should be linked together, replayed, or
collapsed into current content. Without a shared shape for this, every consumer that needs
"latest version of X" would have to invent its own ad hoc linking convention.

### Proposal

Add a `revision` content format: a BLOB that represents one step in the evolution of a
mutable object, linking back to its parent revision(s) (DAG, not just a chain, so concurrent
edits can merge) and carrying either the full materialized content or an incremental diff
against the parent(s).

The format and its supporting functions live in a new `fs/cas/evo/module.f.ts` submodule
("evo" for evolution), following the existing `fs/cas/cli/` and `fs/cas/mcp/` layout. This
keeps `fs/cas/module.f.ts` focused on hashing/addressing, and gives head resolution,
materialization, and the diff format a shared home next to the schema.

```ts
export const revision = {
    /**
     * Format tag: identifies this BLOB as a revision. Key = type
     * discriminant; value is the URL of the format spec for now,
     * later a hash of the spec.
     */
    evolution: 'https://functionalscript.com/fs/cas/evo/README.md',

    /** Identity of the mutable object being revised. */
    object: ref,

    /** Parent Revision BLOBs. Empty array means this is the first revision. */
    parents: array(ref),

    /**
     * Complete materialized content of this revision.
     *
     * If present, this is authoritative and `changes` do not need to be replayed.
     */
    content: option(ref),

    /**
     * Incremental changes introduced by this revision.
     *
     * Used only when `content` is absent.
     */
    changes: option(array(ref)),

    /**
     * Optional cached generation number within the object's evolution.
     *
     * Normally:
     *   generation = 0 for the first revision
     *   generation = 1 + max(parent.generation)
     */
    generation: option(number),

    /**
     * Marks the mutable object as archived/inactive.
     *
     * The revision still exists; it is just hidden from normal active views.
     */
    archived: option(true),
} as const
```

Notes on the shape:

- `ref` is a URL in content-addressed digital space. For now two forms are recognized: a
  cbase32 hash (a native CAS address, see `fs/cbase32/`), and a standard `https://` URL as a
  bridge to the legacy location-addressed web. More forms are planned. Some ref positions
  are restricted to hashes only — `parents` is one: a parent revision is a CAS blob, so a
  bridge URL cannot stand in for it. Note that the `evolution` tag value is itself a ref
  under this definition — an `https://` bridge URL today, a CA reference later — so the
  tag's migration path is just the general evolution of `ref`, not a special case.
- `evolution` is a self-describing format tag. In a generic CAS a blob is just bytes under a
  hash, so without a discriminant a reader can only recognize a revision by guessing from its
  shape, which collides with any other format that happens to have `object`/`parents` fields.
  The tag gives format detection (tools can recognize revisions while walking a store),
  versioning (readers reject or migrate blobs of an incompatible version instead of silently
  misreading them), and a cheap pre-validation gate. The key doubles as the type discriminant.
  In this first revision of the format the value is hard-coded as a literal — the URL of the
  format spec, `"https://functionalscript.com/fs/cas/evo/README.md"` — the XML-namespace/
  JSON-LD approach: globally unique without a registry, self-documenting, and validated by
  the schema itself since the literal is part of the schema. The spec is the `README.md` of
  the `fs/cas/evo` module (creating it is part of the tasks below); once it exists in the
  repo it is automatically deployed to functionalscript.com, so the URL dereferences to the
  live spec. Later versions of the format migrate the value to a content-addressed revision
  reference: the spec is itself a mutable object evolved by this very format, so the
  reference combines the spec's object identity with a version pin — stable identity across
  versions, pinned version per blob, no registry, per the deduplication principle. The exact
  reference syntax is not defined yet (`hash.generation` alone does not pin a version across
  branches; something like `{hash}.{generation}.{hash}` may be needed) — for now we use only
  hashes. Two known costs of the interim URL,
  accepted knowingly and fixed by that migration: the URL is a mutable pointer (the document
  behind it can change), so the value identifies the format but not its version; and it
  anchors the identifier to DNS, which vision.md argues against for the end state.
- `object` gives every revision of the same mutable thing a common anchor to resolve
  "current head(s)" against, without requiring a mutable pointer anywhere in CAS itself —
  the head is whatever revision(s) reference `object` and are not themselves a parent of
  another revision. `object` identity normally comes from the first `content`: the hash of
  the object's initial content is the object's identity. Two objects created from identical
  initial content therefore share an identity — this is by design: it is fine to have many
  changes of the same object from different users. When distinct identity is wanted, a ref
  can carry an additional nonce (`{hash}-{nonce}`). Digital signatures (a separate, future
  spec) will filter changes from unknown users. `object` is also the fallback for `parents`
  in all cases: a revision with no parents uses `object` as its base, with or without
  `changes` (see the algorithm below).
- `parents` is an array to support merges (multiple concurrent lines of history converging),
  matching the "multi-device / multi-user, merge freely" model in
  [vision.md](../../../todo/plan/vision.md).
- **Materialization algorithm** — `content` has priority; the fields are not mutually
  exclusive by schema, resolution is by precedence. The base of a revision is its
  materialized parent, or `object` itself when `parents` is empty (in all cases, with or
  without `changes`):
  1. if `content` is present, use it;
  2. otherwise, apply `changes` on the base;
  3. otherwise (no `changes`), use the base.
  Materialization through multiple parents is only defined when every path references a
  single common ancestor, the intermediate revisions have no `content`, and all `changes`
  are CRDTs (so application is order-independent). The first iteration does not implement
  `changes` at all, so for now the algorithm requires zero or one parent; a multi-parent
  (merge) revision must carry `content`.
- **Conflicting concurrent heads** are resolved the same way as in Git: a merge tool creates
  a new revision that references the conflicting revisions as `parents`. The format itself
  does not resolve conflicts; it records their resolution. CAS synchronization MUST never
  care about merge conflicts — an object can legitimately have many heads in a store at any
  time. An application can propose a merge revision; sync just moves blobs.
- `changes` entries will most likely point to an event log, most likely CRDT-based, but the
  refs may point to different (not yet defined) formats.
- `generation` is a cache, not a source of truth — it must always be re-derivable from
  `parents`, and a consumer must not trust a `generation` it has not verified against the
  actual parent chain from an untrusted source.
- `archived` signals that we no longer work with the object — for example, a task that is
  done. An archived object's blobs can be deleted from a local CAS after a backup. The field
  follows the existing `option(true)` idiom (a presence-only flag) rather than
  `option(boolean)`, matching the convention already used elsewhere in the RTTI-typed schemas
  under `fs/types/rtti`.

Open design points:

- The `changes` event-log/CRDT format(s) still need to be defined (not implemented in the
  first iteration).
- Future `ref` forms beyond cbase32 hashes and `https://` bridge URLs (including the
  optional `{hash}-{nonce}` form for distinct object identity), and which ref positions
  besides `parents` are hash-only (`object`? `content`? `changes`?) — possibly two schema
  types, a general `ref` and a hash-only ref.
- Whether other content formats should share the same tagging convention, and the exact
  syntax of the future CA revision reference (e.g. `{hash}.{generation}.{hash}`; undefined
  for now — only hashes are used).
- Digital signatures for filtering changes from unknown users — a separate, future spec.
- Further out (subject for a separate spec): a `{public-key}/{name}.{generation}` form,
  where the key's owner defines what `{name}` means. Anchoring the identifier in a signer
  ties format identity to the web of trust (vision.md's `~/Alice/...` relative-path model)
  and solves the many-generations-from-many-users problem: the key prefix says whose
  evolution of `{name}` a blob follows.

### Tasks

- [ ] Create `fs/cas/evo/README.md` — the format spec the `evolution` tag URL points to
      (deployed automatically to functionalscript.com once it exists in the repo)
- [ ] Define `ref` as a URL in CA digital space, recognizing cbase32 hashes and `https://`
      bridge URLs for now
- [ ] Create `fs/cas/evo/module.f.ts` with the RTTI schema for `revision` (`fs/types/rtti`)
      and its derived TS type
- [ ] Implement head resolution: given `object`, find revision(s) not reparented by any
      other (a store-wide reverse index; heads can be demoted retroactively by sync)
- [ ] Implement content materialization for the first iteration (zero or one parent, no
      `changes`): `content` → base, where base = parent's materialization or `object`
- [ ] Implement (or specify) a merge tool that resolves concurrent heads into a new revision
      with multiple `parents` and `content`
- [ ] Tests: linear history, branch + merge, many heads for one object, archived object,
      generation cache mismatch, first revision materializing from `object`, a head demoted
      retroactively by a newly synced revision
- [ ] Later iteration: define the `changes` event-log/CRDT format and extend materialization
      to CRDT changes over a single common ancestor
- [ ] Reference the format from `fs/cas/README.md`

### Related

- `todo/plan/vision.md` — DISOT block types (signature, trust, license, redirect) this format
  sits alongside
- [66g-cas-verify-command](66g-cas-verify-command.md) — integrity checking applies equally to
  revision BLOBs
