## `evo_revision`: typed read of a single revision

**Priority:** P3
**Status:** open

### Problem

The mainline history design
([`todo/subject-history.md`](subject-history.md)) deliberately returns bare
hashes and leaves node detail — merge parents, the snapshot pointer, the
`archived` flag — to the client. The only path to that detail today is
`cas_get` + client-side decoding, which has three problems:

1. **Canonicalization.** cbase32 hashes have alias spellings (case,
   `i`/`l`/`o`), and `Evo` normalizes everything through `canonicalHash`
   (`fjs/cas/evo/module.f.ts`): `evo_head` — and the planned `evo_history` —
   return canonical spellings. A raw blob's `parents` carry whatever
   spellings its writer used, so the history design's client-side rules
   ("expand `parents[i]` with `history(...)`", "stop at the first hash
   you've seen") compare raw-blob strings against canonical API output — an
   alias spelling breaks the comparison silently. Every client would need
   to know about cbase32 aliasing; that does not scale.
2. **Validation duplication.** With bare `cas_get`, each client
   re-implements JSON parsing, schema validation, the `dialect` check, and
   `isHash` on every reference. `decodeRevisionBlob`
   (`fjs/cas/evo/module.f.ts`) already does all of it, server-side, and is
   already exported.
3. **Consumer profile.** The MCP tools are consumed by agents; leaving the
   *interpretation* of raw bytes to the least reliable layer is the wrong
   default.

### Chosen design

A typed read, alongside the existing operations:

```ts
/** The revision at `hash`, decoded, validated, and canonicalized. */
readonly revision: (hash: Hash) => Effect<O | MemOp, Result<RevisionData, string>>
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

`AddRevision` (`fjs/cas/evo/module.f.ts`) is renamed **`RevisionData`** and
becomes the *single* vocabulary of both directions — `evo_add` takes it,
`evo_revision` returns it, and "what you add is what you get back". No
extension or intersection types: one structure, every direction-specific
field optional, with the per-direction guarantees documented rather than
typed:

```ts
export type RevisionData = {
    readonly parents: readonly Hash[]
    readonly snapshot?: Hash | undefined
    readonly subject?: Subject | undefined
    readonly archived?: true | undefined
    readonly generation?: number | undefined
}
```

- `RevisionData` is the media-level `Revision` minus `dialect` — and
  dropping `dialect` on output is a feature: it is a serialization tag with
  no information once past validation. The evo layer speaks the semantic
  content of a revision, the same in both directions.
- The only field the rename *adds* is `generation`; `add` already computes
  and writes the authoritative value and already resolves an absent
  `snapshot` (see [`fjs/media/revision/README.md`](../../../media/revision/README.md)
  and `addRevision`'s JSDoc). What is still missing is the input field
  itself, so a value read back from `evo_revision` can be fed to `evo_add`
  unchanged, without stripping fields — the round trip is the point of the
  shared type.
- Optionality means different things per direction, documented per field:
  - `subject` — input: absent means "infer from my single parent"; output:
    always present.
  - `snapshot` — input: absent is a write-boundary convenience resolved at
    `add`; output: **always present** — the canonical stored snapshot.
  - `generation` — input: **ignored**, the server computes the
    authoritative value; output: always present.
- The returned `parents`/`snapshot` are canonical cbase32 spellings, so
  they compare directly against `evo_head`/`evo_history` output.
- The rename touches the `fjs/cas/evo/mcp` doc table but not `evo_add`'s
  wire shape.

### Open question: cross-subject parents

The format's epoch-reset scenario (a new subject formed from an old one,
still listing its origin as `parents` — see
[`fjs/media/revision/README.md`](../../../media/revision/README.md)) is
currently rejected at the *evo* layer: `validateParentSubjects`
(`fjs/cas/evo/module.f.ts`) requires every parent to share the revision's
`subject`. The format itself never forbade cross-subject parents, so
allowing that scenario is an evo-layer relaxation — one that would also
touch the closure assumption behind the subject-history design (a mainline
walk could then cross into another subject's revisions, which is arguably
the point: the history *shows how it was formed*). Not decided here;
recorded so the decision is made deliberately, not by accident.

### Implementation notes

- **Errors.** Three distinct failures, each a proper message rather than
  `null`: `hash` is not a cbase32 string; the hash is not present in the
  store; the blob is present but not a valid revision (bad UTF-8/JSON,
  wrong dialect, failed schema or reference check). `decodeRevisionBlob`
  (`fjs/cas/evo/module.f.ts`) cannot serve this contract as-is — it
  deliberately collapses the read error and every decode failure into one
  `null`, because it exists for scanning stores containing arbitrary
  content, and `resolveParent` built on it likewise folds "missing" and
  "not a revision" into a single message. `revision(hash)` therefore
  performs the two stages itself — the read (a miss → "not present")
  separately from the decode (a failure → "not a revision") — the same
  split `decodeRevisionBlob` composes internally, just without discarding
  which stage failed.
- **Serving.** v1 serves each call with a store round trip, but per the
  error contract above it is a separate `cas.read` followed by a decode
  step — not a `decodeRevisionBlob` call, which cannot tell "not present"
  from "not a revision". The per-revision cache planned in
  [`todo/subject-history.md`](subject-history.md) (`hash → ordered
  parents`) can memoize `generation` alongside — both are immutable, so
  neither can go stale — but that is an optimization, not a requirement:
  the cache holds only part of what `evo_revision` returns.
- **MCP output** is the JSON of `RevisionData` with the output guarantees
  above: `{ subject, parents, snapshot, archived?, generation }` — only
  `archived` is genuinely optional on output.

### Tasks

- [ ] Rename `AddRevision` → `RevisionData` (adding the optional
      `generation` input field, ignored by `add`), update the
      `fjs/cas/evo/mcp` doc table, and cover the
      "supplied-`generation`-ignored" case in `proof.f.ts`.
- [ ] Implement `revision(hash)` on `Evo<O>` with proof coverage for all
      three error cases and for canonicalized output (a parent stored under
      an alias spelling comes back canonical).
- [ ] Expose `evo_revision` through MCP (`fjs/cas/evo/mcp`) and document it
      in `fjs/cas/evo/README.md` / `fjs/cas/evo/mcp/README.md`.
- [ ] Decide the cross-subject-parents question (separate todo if
      accepted).

### Related

- [`todo/subject-history.md`](subject-history.md) — the mainline walk this
  tool is the node-detail companion to.
- [`fjs/media/revision/README.md`](../../../media/revision/README.md) — the
  `vnd.fjs.revision` format whose stored fields this read returns, including
  the required `generation`/`snapshot` and the epoch-reset semantics.
