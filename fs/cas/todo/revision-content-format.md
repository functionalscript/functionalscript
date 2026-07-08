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
     * Format tag: identifies this BLOB as a revision and carries the
     * format version. Key = type discriminant; value is a version
     * string (e.g. "0.0.0") for now, later a hash of the format spec.
     */
    evolution: string,

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

- `evolution` is a self-describing format tag. In a generic CAS a blob is just bytes under a
  hash, so without a discriminant a reader can only recognize a revision by guessing from its
  shape, which collides with any other format that happens to have `object`/`parents` fields.
  The tag gives format detection (tools can recognize revisions while walking a store),
  versioning (readers reject or migrate blobs of an incompatible version instead of silently
  misreading them), and a cheap pre-validation gate. The key doubles as the type discriminant.
  The schema types the value as `string` rather than a literal so the value can migrate
  without a schema change: a version string (`"0.0.0"`) for now, later a hash of the format
  spec — the spec stored in CAS, its hash a universal registry-free format identifier, per
  the deduplication principle. The cost of the loose type is that the schema alone does not
  validate the discriminant; recognizing a supported revision is a reader-side check against
  known values, which it would have to be anyway once several values (versions, then spec
  hashes) coexist.
- `object` gives every revision of the same mutable thing a common anchor to resolve
  "current head(s)" against, without requiring a mutable pointer anywhere in CAS itself —
  the head is whatever revision(s) reference `object` and are not themselves a parent of
  another revision. `object` identity normally comes from the first `content`: the hash of
  the object's initial content is the object's identity. This also makes `object` the
  materialization fallback of last resort (see the algorithm below).
- `parents` is an array to support merges (multiple concurrent lines of history converging),
  matching the "multi-device / multi-user, merge freely" model in
  [vision.md](../../../todo/plan/vision.md).
- **Materialization algorithm** — `content` has priority; the fields are not mutually
  exclusive by schema, resolution is by precedence:
  1. if `content` is present, use it;
  2. otherwise, apply `changes` on the materialized parent;
  3. otherwise (no `changes`), use the parent's materialization;
  4. otherwise (no `parents`), use `object` itself as the content.
- **Conflicting concurrent heads** are resolved the same way as in Git: a merge tool creates
  a new revision that references the conflicting revisions as `parents`. The format itself
  does not resolve conflicts; it records their resolution.
- `changes` entries will most likely point to an event log, most likely CRDT-based, but the
  refs may point to different (not yet defined) formats.
- `generation` is a cache, not a source of truth — it must always be re-derivable from
  `parents`, and a consumer must not trust a `generation` it has not verified against the
  actual parent chain from an untrusted source.
- `archived` follows the existing `option(true)` idiom (a presence-only flag) rather than
  `option(boolean)`, matching the convention already used elsewhere in the RTTI-typed schemas
  under `fs/types/rtti`.

Open design points:

- The `changes` event-log/CRDT format(s) still need to be defined.
- Version-compatibility policy for the `evolution` tag: what a reader does with a newer
  minor vs. a newer major version, and whether other content formats should share the
  same tagging convention.

### Tasks

- [ ] Create `fs/cas/evo/module.f.ts` with the RTTI schema for `revision` (`fs/types/rtti`)
      and its derived TS type
- [ ] Define the `changes` event-log/CRDT format, or reference an existing one
- [ ] Implement head resolution: given `object`, find revision(s) not reparented by any other
- [ ] Implement content materialization following the precedence algorithm
      (`content` → `changes` on parent → parent → `object`)
- [ ] Implement (or specify) a merge tool that resolves concurrent heads into a new revision
      with multiple `parents`
- [ ] Tests: linear history, branch + merge, archived object, generation cache mismatch,
      first revision materializing from `object`
- [ ] Document the format in `fs/cas/README.md`

### Related

- `todo/plan/vision.md` — DISOT block types (signature, trust, license, redirect) this format
  sits alongside
- [66g-cas-verify-command](66g-cas-verify-command.md) — integrity checking applies equally to
  revision BLOBs
