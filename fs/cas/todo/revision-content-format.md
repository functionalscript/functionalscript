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

- `object` gives every revision of the same mutable thing a common anchor to resolve
  "current head(s)" against, without requiring a mutable pointer anywhere in CAS itself —
  the head is whatever revision(s) reference `object` and are not themselves a parent of
  another revision.
- `parents` is an array to support merges (multiple concurrent lines of history converging),
  matching the "multi-device / multi-user, merge freely" model in
  [vision.md](../../../todo/plan/vision.md).
- `content` vs `changes` lets a revision be self-sufficient (full snapshot, cheap random
  reads) or cheap to write (diff-only, requires replay from an ancestor with `content` set).
  Exactly one should be considered normative when both could theoretically apply — see open
  design points.
- `generation` is a cache, not a source of truth — it must always be re-derivable from
  `parents`, and a consumer must not trust a `generation` it has not verified against the
  actual parent chain from an untrusted source.
- `archived` follows the existing `option(true)` idiom (a presence-only flag) rather than
  `option(boolean)`, matching the convention already used elsewhere in the RTTI-typed schemas
  under `fs/types/rtti`.

Open design points:

- How to resolve conflicting concurrent revisions (multiple non-ancestor heads) — is
  reconciliation a job for a further revision with multiple `parents`, or does it stay
  application-defined?
- Whether `content`/`changes` should be mutually exclusive by schema (a tagged union) rather
  than "both optional, pick one by convention."
- What `changes` entries actually point to — a diff format is not yet defined.
- Where `object` identity comes from: a random nonce chosen at creation, or the hash of the
  first revision itself.

### Tasks

- [ ] Decide `object` identity convention (nonce vs. genesis-revision hash)
- [ ] Create `fs/cas/evo/module.f.ts` with the RTTI schema for `revision` (`fs/types/rtti`)
      and its derived TS type
- [ ] Define a `changes` diff format, or reference an existing one, for the incremental case
- [ ] Implement head resolution: given `object`, find revision(s) not reparented by any other
- [ ] Implement content materialization: replay `changes` from the nearest ancestor with
      `content` set
- [ ] Decide and implement conflict handling for multiple concurrent heads
- [ ] Tests: linear history, branch + merge, archived object, generation cache mismatch
- [ ] Document the format in `fs/cas/README.md`

### Related

- `todo/plan/vision.md` — DISOT block types (signature, trust, license, redirect) this format
  sits alongside
- [66g-cas-verify-command](66g-cas-verify-command.md) — integrity checking applies equally to
  revision BLOBs
