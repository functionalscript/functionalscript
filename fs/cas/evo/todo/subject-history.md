## Return a subject's revision history

**Priority:** P3
**Status:** open — design chosen, not yet implemented

### Problem

`Evo<O>` (`fs/cas/evo/module.f.ts`) only exposes `head(subject)` — the
current head hashes — and `list()` — all known subjects. There is no way to
retrieve a subject's *history*: the revisions that led up to its current
head(s). A client that wants to render history, walk past merges, or
reconstruct an earlier state of the subject has to `head(subject)` and then
walk parent links itself, one `cas_get` at a time — there is no single call
for "everything belonging to this subject".

The history is not a simple sequence: `vnd.fjs.revision` (`fs/media/revision`)
is a DAG (multiple parents on a merge, and a subject can have multiple
concurrent heads), so whatever shape this returns has to represent branching
and merging, not just a linear list.

### Chosen design: the mainline walk

`parents[0]` of a revision is its **mainline** parent — the branch the
revision landed on, in the sense of Git's first-parent link. This is now a
documented commitment of the `vnd.fjs.revision` format itself
(`fs/media/revision/README.md`), not just of this API: merge-creating
clients list the branch they merged *into* first, and the parent order is
load-bearing from here on.

The history operation walks exactly that link:

```ts
/** First-parent chain starting at (and including) `start`. */
readonly history: (start: Hash) => Effect<O | MemOp, Result<readonly Hash[], string>>
```

- **Return shape is just `readonly Hash[]`** — the same primitive
  `head(subject)` already returns. Element 0 is `start` in its *canonical*
  cbase32 spelling — decoded and re-encoded, never echoed: cbase32 accepts
  alias spellings (case, `i`/`l`/`o`), and an input alias leaking into the
  result would be the one non-canonical hash in an otherwise canonical
  API, breaking the client-side seen-hash comparison. Each next element is
  the previous element's `parents[0]`; the array ends at a root
  (`parents: []`). Adjacency *is* the mainline edge; there is no other
  structure in the value.
- **Merges are discovered by the client, not encoded here.** A v1 item is a
  bare hash. A client that wants merge markers (or the merged-in branches)
  fetches the revision via the typed companion read
  [`todo/evo-revision.md`](evo-revision.md) (`evo_revision`, which decodes,
  validates, and canonicalizes server-side) and reads its full `parents`;
  every parent beyond index 0 is a merged-in branch, and its own history is
  one more `history(parent)` call. The API adds no data a client couldn't
  already reach — it adds the walk.
- **Multiple concurrent heads need no special encoding.** `history` takes a
  starting *revision*, not a subject: the client calls `head(subject)`
  (`readonly Hash[]`) and then `history(h)` per head. One operation covers
  heads and merged-in branches alike.
- **No pagination in v1** — `history` returns the full chain to the root.
  A `limit` parameter can be added compatibly in a future release (an
  optional parameter is a non-breaking addition). When it is, the designed
  semantics are: the last element of a page doubles as the resume anchor
  (re-call `history` with it and drop the repeated first element), so a
  supplied `limit` must be at least 2 — rejected, not clamped, when
  smaller, since with `limit = 1` a caller could never advance
  (`history(h, 1)` would return `[h]` forever).
- **Convergence rule.** Expanding a merged-in branch eventually rejoins
  ancestry the client already holds (at the common ancestor, then all the
  way to the root). The client-side rule is: stop at the first hash you
  have already seen. A server-side `until` parameter is possible later but
  not part of v1.
- **Archived revisions are included.** The walk follows parent links, and a
  parent doesn't stop being a parent by being `archived`.
- **Upgrade path (decided now, taken never or later).** If a client ever
  needs merge parents inline, the chosen path is an options flag — e.g.
  `history(start, { parents: true })` returning
  `readonly (readonly [Hash, ...Hash[]])[]` (item 0 = the revision, rest =
  its non-mainline parents) — not a change to the default `readonly Hash[]`
  shape, and not a second tool. The v1 contract never changes.

### Implementation notes

- **The cache can't serve the walk yet.** `SubjectState`
  (`fs/cas/evo/module.f.ts`) deliberately stores `hashes` and `parents` as
  flat, order-independent sets — enough for `headsOf`, not enough to follow
  a first-parent chain. Preferred fix: extend the cache with a per-revision
  `hash → ordered parents` map. Revision blobs are immutable, so that
  mapping can never go stale (unlike heads), and the walk becomes pure
  in-memory. It also doesn't threaten the fold-order-independence invariant
  documented at the top of the module — the per-revision parent list is
  fixed data carried by each blob, not something accumulated across fold
  order. (The alternative — `cas_get` + decode per step at call time —
  works but costs O(chain) I/O per call.)
- **Errors.** `start` must resolve and decode as a revision
  (`resolveParent` already implements exactly this check for `add`);
  otherwise `history` returns the error. A decode failure *mid-walk*
  (corrupt or missing parent blob) is also an error, not a silent
  truncation.
- **Staleness.** Same cache-staleness concern as
  [`todo/cache-staleness.md`](cache-staleness.md) — history is served from
  the in-memory cache like everything else in `Evo<O>`.
- **MCP surface.** A new `evo_history` tool (`fs/cas/evo/mcp/module.f.ts`)
  alongside `evo_list`/`evo_head`/`evo_add`, taking `start` (hash) and
  returning the hash array. Evo-specific, so a dedicated tool name is fine
  (unlike the generic refresh tool in `cache-staleness.md`).

### Discarded alternatives

Earlier candidates, kept for the record:

1. **Just the node set** — return `SubjectState.hashes`. Free to compute
   and closed under "is a parent of" (thanks to `validateParentSubjects`),
   but unordered: N extra fetches for the client to see *any* structure,
   including plain display order.
2. **Edge list** — `readonly (readonly [Hash, readonly Hash[]])[]`. Whole
   DAG in one response, no hash-as-object-key risk, but response size is
   the whole history and the client still reconstructs everything itself.
3. **Adjacency map keyed by hash** — reads naturally as "the DAG" but uses
   hashes as object keys, the own-property-lookup class of risk the Evo
   cache's `at` was added to guard against.
4. **Recursive first-parent grammar** — a flat mainline array where a merge
   becomes a nested bracket `[node, mergedParent]`, recursively. Had the
   right asymmetry (first-parent vs merged-in) but paid for it with a
   recursive encoding, special cases for merges at the sequence start and
   three-plus-parent merges, and an unresolved question for multiple
   concurrent heads.

The chosen design keeps option 4's first-parent asymmetry and drops its
grammar: laziness (per-branch `history` calls) replaces recursion, and the
one thing options 1–2 did better — the *entire* DAG in a single call — is
the rare consumer, still reachable in O(branches) calls.

### Tasks

- [x] Pick a history representation and write out its exact shape and
      reconstruction algorithm (this document).
- [x] Decide the open questions (archived revisions: included; size: full
      chain in v1, `limit` deferred to a future release with
      resume-by-last-hash semantics; staleness: inherited from
      `cache-staleness.md`; MCP tool: `evo_history`).
- [x] Document the `parents[0]`-is-mainline commitment in
      `fs/media/revision/README.md`.
- [ ] Extend the Evo cache with the per-revision `hash → ordered parents`
      map (immutable, never stale).
- [ ] Implement `history(start)` on `Evo<O>` with proof coverage,
      including a subject with a merge (multiple parents), a subject with
      multiple concurrent heads, an unknown or non-revision `start`, and a
      `start` given in an alias spelling (element 0 comes back canonical).
- [ ] Expose it through MCP (`fs/cas/evo/mcp`) and document it in
      `fs/cas/evo/README.md` / `fs/cas/evo/mcp/README.md`.

### Related

- [`todo/evo-revision.md`](evo-revision.md) — the typed single-revision
  read (`evo_revision`) that serves the node detail this walk deliberately
  omits, and the required-`generation` format decision.
- [`todo/cache-staleness.md`](cache-staleness.md) — history is read from the
  same in-memory cache, so it inherits that staleness question.
- `fs/media/revision/README.md` — the `vnd.fjs.revision` DAG shape
  (`parents`, merges, concurrent heads) this history walks, including the
  first-parent (mainline) ordering commitment.
