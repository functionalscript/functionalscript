## `evo_revision`: typed read of a single revision

**Priority:** P3
**Status:** open — design chosen, not yet implemented

### Problem

The mainline history design
([`todo/subject-history.md`](subject-history.md)) deliberately returns bare
hashes and leaves node detail — merge parents, the snapshot pointer, the
`archived` flag — to the client. The only path to that detail today is
`cas_get` + client-side decoding, which has three problems:

1. **Canonicalization.** cbase32 hashes have alias spellings (case,
   `i`/`l`/`o`), and `Evo` normalizes everything through `canonicalHash`
   (`fs/cas/evo/module.f.ts`): `evo_head` — and the planned `evo_history` —
   return canonical spellings. A raw blob's `parents` carry whatever
   spellings its writer used, so the history design's client-side rules
   ("expand `parents[i]` with `history(...)`", "stop at the first hash
   you've seen") compare raw-blob strings against canonical API output — an
   alias spelling breaks the comparison silently. Every client would need
   to know about cbase32 aliasing; that does not scale.
2. **Validation duplication.** With bare `cas_get`, each client
   re-implements JSON parsing, schema validation, the `dialect` check, and
   `isHash` on every reference. `decodeRevisionBlob`
   (`fs/cas/evo/module.f.ts`) already does all of it, server-side, and is
   already exported.
3. **Consumer profile.** The MCP tools are consumed by agents; leaving the
   *interpretation* of raw bytes to the least reliable layer is the wrong
   default.

### Chosen design

A typed read, alongside the existing operations:

```ts
/** The revision at `hash`, decoded, validated, and canonicalized. */
readonly revision: (hash: Hash) => Effect<O | MemOp, Result<RevisionView, string>>
```

exposed over MCP as **`evo_revision`**, args `{ hash }`. The name follows
the house pattern — one noun per read tool, namespace as scope: `evo_head`
is "the heads of this subject", `evo_revision` is "the revision at this
hash". (`evo_get` was rejected: it implies `cas_get`-scoped-to-evo, i.e.
raw bytes, which is exactly what this tool is not — the `get` verb stays
reserved for "raw bytes by hash". `evo_get_revision` says nothing
`evo_revision` doesn't and breaks the one-token-per-tool style.)

`cas_get` remains the generic raw-bytes tool for arbitrary blobs
(snapshots, non-revision content); `evo_revision` is the typed view for
revisions specifically. Layering, not duplication — `evo_add` validates on
the way in, `evo_revision` validates on the way out.

Together with `evo_history` the merge-expansion loop becomes mechanical:
`evo_history` gives the chain, `evo_revision` gives node detail (every
`parents` entry past index 0 is a merged-in branch), `evo_history(parent)`
expands a branch — without the client ever touching raw bytes.

### One shared structure: `AddRevision` → `RevisionData`

`AddRevision` (`fs/cas/evo/module.f.ts`) is renamed **`RevisionData`** and
becomes the shared vocabulary of both directions — `evo_add` takes it,
`evo_revision` returns it (refined), and "what you add is what you get
back":

```ts
export type RevisionData = {
    readonly parents: readonly Hash[]
    readonly snapshot?: Hash | undefined
    readonly subject?: Subject | undefined
    readonly archived?: true | undefined
}

/** What `revision(hash)` returns: the data plus what the server always knows. */
export type RevisionView = RevisionData & {
    readonly subject: Subject
    readonly generation: number
}
```

- `RevisionData` is exactly the media-level `Revision` minus `dialect` and
  `generation` — and dropping `dialect` on output is a feature: it is a
  serialization tag with no information once past validation. The evo layer
  speaks the semantic content of a revision, the same in both directions.
- Optionality means different things per direction, which the refinement
  captures: on input, absent `subject` means "infer from my single parent"
  and absent `snapshot` means "inherit per the format rules"; on output,
  `subject` is always known (the intersection makes the compiler know it
  too) while `snapshot` passes through as stored (absent = inherited —
  server-side resolution can be a later option).
- The returned `parents`/`snapshot` are canonical cbase32 spellings, so
  they compare directly against `evo_head`/`evo_history` output.
- The rename touches the `fs/cas/evo/mcp` doc table but not `evo_add`'s
  wire shape.

### `generation`: required in the format, computed at `add`

Decided together with this tool (the format is still being designed and no
stored records exist yet, so this is free):

- **The format requires `generation`**: `revisionSchema`
  (`fs/media/revision/module.f.ts`) changes `option(number)` → `number`,
  with "is a non-negative integer" enforced by `validate` on top of the
  structural schema, the same layering as `isHash`. Existence and
  integer-ness are the *correctness* check — a blob failing it is not a
  revision.
- **Continuity is observed, not enforced.** The normative value — `0` for a
  root (`parents: []`), else `1 + max(parents' generations)` — is what
  evo's `add` always writes. But equality with that formula is *not* a
  validity condition for blobs from elsewhere: a deviation is a **signal**
  that someone reset the history/clock — e.g. a revision starting a new
  epoch, such as a new subject that still lists its origin as `parents` to
  show how it was formed. Consumers may surface the discontinuity (an
  epoch-reset indicator); they must not reject the blob for it. Ordering by
  `generation` is therefore reliable within an epoch, and the one-level
  comparison against parents is the cheap epoch-boundary detector.
- **`evo_add` computes it.** `RevisionData` has no `generation` field —
  callers never supply it. `resolveParents` already fetches and decodes
  every parent during `add`, so the computation is a `max` over values
  already in hand, plus the base case `0` for zero parents. Everything evo
  writes follows the formula by construction.
- **`evo_revision` returns the stored value** — always present by format.

### Open question: cross-subject parents

The epoch-reset scenario above ("new subject formed from an old one") is
currently rejected at the *evo* layer: `validateParentSubjects`
(`fs/cas/evo/module.f.ts`) requires every parent to share the revision's
`subject`. The format itself never forbade cross-subject parents, so
allowing that scenario is an evo-layer relaxation — one that would also
touch the closure assumption behind the subject-history design (a mainline
walk could then cross into another subject's revisions, which is arguably
the point: the history *shows how it was formed*). Not decided here;
recorded so the decision is made deliberately, not by accident.

### Implementation notes

- **Errors.** Three distinct failures, each a proper message rather than
  `null`: hash not present in the store; blob present but not a valid
  revision (wrong dialect, failed schema, failed reference check); decode
  failure. `resolveParent` (`fs/cas/evo/module.f.ts`) already implements
  the shape of this check for `add`'s parents.
- **Serving.** v1 reads through `decodeRevisionBlob` like `resolveParent`
  does. The per-revision cache planned in
  [`todo/subject-history.md`](subject-history.md) (`hash → ordered
  parents`) can memoize `generation` alongside — both are immutable, so
  neither can go stale — but that is an optimization, not a requirement:
  the cache holds only part of what `evo_revision` returns.
- **MCP output** is the JSON of `RevisionView`:
  `{ subject, parents, snapshot?, archived?, generation }`.

### Tasks

- [ ] Make `generation` required: `revisionSchema` `option(number)` →
      `number`, non-negative-integer check in `validate`, README update
      (`fs/media/revision/README.md`) including the epoch-reset semantics
      and the continuity-is-not-validity rule, with proof coverage for a
      missing, non-integer, and negative `generation`.
- [ ] Rename `AddRevision` → `RevisionData`, add `RevisionView`, update the
      `fs/cas/evo/mcp` doc table.
- [ ] Compute and write `generation` in `add` (base case `0`, else
      `1 + max`), with proof coverage including a merge of parents with
      differing generations.
- [ ] Implement `revision(hash)` on `Evo<O>` with proof coverage for all
      three error cases and for canonicalized output (a parent stored under
      an alias spelling comes back canonical).
- [ ] Expose `evo_revision` through MCP (`fs/cas/evo/mcp`) and document it
      in `fs/cas/evo/README.md` / `fs/cas/evo/mcp/README.md`.
- [ ] Decide the cross-subject-parents question (separate todo if
      accepted).

### Related

- [`todo/subject-history.md`](subject-history.md) — the mainline walk this
  tool is the node-detail companion to.
- `fs/media/revision/README.md` — the `vnd.fjs.revision` format whose
  `generation` field this makes required.
