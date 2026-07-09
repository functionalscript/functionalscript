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
edits can merge) and carrying the full materialized content. Incremental diffs are
deliberately **not** part of this format: a reader that did not implement diff replay would
silently materialize the wrong content, so an optional `changes` field would be a breaking
change in disguise. Incremental changes will arrive later as their own media type
(`application/vnd.fjs.change+json`, see the versioning rule below), not as a field of this
one.

The design splits the format from the store operations, to keep the dependency graph
acyclic:

- **`fs/media/revision/`** — the pure format: the RTTI schema, the `mediaType` constant,
  encode/decode/validate, and the README spec. No store access, no effects. It must live
  under `fs/media/` (see
  [fs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md))
  because media-type detection has to import the schema to recognize revision blobs, and
  `fs/cas/mcp` already depends on the detector — a format inside `fs/cas` would therefore
  close a `cas` ↔ detector cycle.
- **`fs/cas/evo/`** ("evo" for evolution, following the existing `fs/cas/cli/` and
  `fs/cas/mcp/` layout) — the store-touching operations: head resolution, materialization,
  the per-object reverse index. Depends on `fs/cas` and `fs/media/revision`. This keeps
  `fs/cas/module.f.ts` focused on hashing/addressing.

```ts
export const revision = {
    /**
     * Format tag: identifies this BLOB as a revision and names the
     * media type it should be served with. Must be the first key in the
     * serialized JSON so detection can match the `{"mediaType":"` prefix.
     */
    mediaType: 'application/vnd.fjs.revision+json',

    /**
     * The subject of this revision: the identity of the mutable object
     * being revised ("subject" as in the subject of a certificate).
     */
    subject: ref,

    /**
     * Parent Revision BLOBs. Empty array means this is the first revision.
     *
     * `hash` is the hash-only subset of `ref`: a parent is a CAS blob,
     * so a bridge URL cannot stand in for it.
     */
    parents: array(hash),

    /**
     * Complete materialized content (snapshot) of this revision.
     *
     * If absent, the revision materializes to its base: the parent's
     * materialization, or `subject` itself for a first revision.
     */
    snapshot: option(ref),

    /**
     * Optional cached generation number within the subject's evolution.
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
  cbase32 hash (a native CAS address, see `fs/basen/cbase32/`), and a standard `https://` URL as a
  bridge to the legacy location-addressed web. More forms are planned. Some ref positions
  are restricted to hashes only and use the narrower `hash` type in the schema — `parents`
  is one: a parent revision is a CAS blob, so a bridge URL cannot stand in for it, and a
  revision with a non-CAS parent must not validate.
- `mediaType` is a self-describing format tag. In a generic CAS a blob is just bytes under a
  hash, so without a discriminant a reader can only recognize a revision by guessing from its
  shape, which collides with any other format that happens to have `subject`/`parents` fields.
  The tag gives format detection (tools can recognize revisions while walking a store) and a
  cheap pre-validation gate; the key doubles as the type discriminant. The value is a media
  type in the RFC 6838 vendor tree with the RFC 6839 `+json` structured-syntax suffix:
  the part before `+` (`vnd.fjs.revision`) names the specific format, the
  suffix tells generic tooling the underlying syntax is JSON. No registry entry is required
  for the vendor tree, the string is stable (no mutable URL, no DNS anchoring), and it is
  validated by the schema itself since the literal is part of the schema. The format spec
  lives in the `README.md` of the `fs/media/revision` module (creating it is part of the
  tasks below; once in the repo it is automatically deployed to functionalscript.com) — the spec
  is referenced by the schema/docs rather than encoded in the tag value. **Versioning rule:**
  additive, compatible changes keep the tag — RTTI struct validation accepts undeclared keys
  by design, so a blob with extra fields still validates against the v1 schema, and that is
  the intended forward-compatibility path. An **incompatible** change MUST NOT reuse the tag:
  it introduces a new media type (for example
  `application/vnd.fjs.revision2+json`), so readers of the old format never
  validate — and never silently misread — a blob of the new one. The tag is therefore the
  version discriminant for breaking changes; no `version` field is needed. This rule is why
  an earlier draft's optional `changes` field (incremental diffs replayed over the base) was
  dropped: it is *schema*-additive but *semantically* breaking — a v1 reader would still
  validate such a blob and materialize the base, silently ignoring the changes. Incremental
  changes are therefore a future separate format, `application/vnd.fjs.change+json` —
  `snapshot` vs `change` is the standard snapshot/delta dichotomy of event-sourced systems.
- **Universal detection convention** — the tag is not revision-specific: every FS content
  format is a JSON object whose **first** key is `mediaType`, so detection matches the byte
  prefix `{"mediaType":"application/vnd.fjs.` and then validates against the schema of the
  named type. The key is spelled `mediaType`, not `mimeType` or `contentType`:
  - `mimeType` is the field name MCP JSON uses at top level — resource contents are
    `{ uri, mimeType, text | blob }` and our own `cas_get` tool result is
    `{ length, mimeType, type[, uri] }` (see
    [../mcp/todo/cas-get-mcp-resource-response.md](../mcp/todo/cas-get-mcp-resource-response.md)).
    Any such response stored back into CAS would false-positive a `{"mimeType":` prefix
    sniff; `mediaType` keeps the stored-format tag and the MCP wire vocabulary disjoint.
  - `contentType` echoes the HTTP header, which carries parameters (`; charset=...`) the
    tag never has — and `content` is already a colliding term in MCP
    (`CallToolResult.content`), the very reason `cas_get` renamed its `content` key away.
  - `mediaType` is the RFC 6838 term ("MIME type" is the legacy name), and it matches the
    `fs/media/` bucket where the formats live.
  The MCP server still serves the value under the protocol-mandated response key
  `mimeType`; the stored-tag → wire-field mapping is one line in the server.
- **Serving the tag as the response `mimeType`**: the MCP server (`cas_get` and the future
  resource read) can respond with the blob's own `mediaType` instead of falling back to the
  generic `text/plain` sniff — but it must never echo the field blindly. A stored blob is
  untrusted input: anyone can store `{"mediaType": "text/html", ...}` and turn the server
  into a content-type oracle. The rule: surface the stored `mediaType` only when it matches
  an allowlist of known `application/vnd.fjs.*+json` types and the blob
  validates against that type's schema; everything else falls through to the existing
  `fs/mime` detector. Validation requires materializing and parsing the blob, and the
  metadata path is deliberately size-independent (`detectStream`, O(1) space, never
  buffers), so the check is **size-bounded**: it is attempted only for blobs up to the
  existing 128 KiB inline-content cap; a larger blob always gets the plain `detectStream`
  result. Revision blobs are small JSON, so the bound costs nothing in practice.
- `subject` gives every revision of the same mutable thing a common anchor to resolve
  "current head(s)" against, without requiring a mutable pointer anywhere in CAS itself —
  the head is whatever revision(s) reference `subject` and are not listed as a parent by
  another revision *of the same `subject`* — a revision of a different subject referencing
  the same hash (or an unrelated blob imported by sync) must not demote a head. Subject
  identity normally comes from the first `snapshot`: the hash of
  the subject's initial content is the subject's identity. Two subjects created from identical
  initial content therefore share an identity — this is by design: it is fine to have many
  changes of the same object from different users. When distinct identity is wanted, a ref
  can carry an additional nonce (`{hash}-{nonce}`). Digital signatures (a separate, future
  spec) will filter changes from unknown users. `subject` is also the fallback for `parents`:
  a revision with no parents uses `subject` as its base (see the algorithm below).
- `parents` is an array to support merges (multiple concurrent lines of history converging),
  matching the "multi-device / multi-user, merge freely" model in
  [vision.md](../../../todo/plan/vision.md).
- **Materialization algorithm** — the base of a revision is its materialized parent, or
  `subject` itself when `parents` is empty:
  1. if `snapshot` is present, use it;
  2. otherwise, use the base.
  A revision with multiple `parents` (a merge) must carry `snapshot`: with more than one
  parent there is no single base to fall back to.
- **Conflicting concurrent heads** are resolved the same way as in Git: a merge tool creates
  a new revision that references the conflicting revisions as `parents`. The format itself
  does not resolve conflicts; it records their resolution. CAS synchronization MUST never
  care about merge conflicts — a subject can legitimately have many heads in a store at any
  time. An application can propose a merge revision; sync just moves blobs.
- `generation` is a cache, not a source of truth — it must always be re-derivable from
  `parents`, and a consumer must not trust a `generation` it has not verified against the
  actual parent chain from an untrusted source.
- `archived` signals that we no longer work with the object — for example, a task that is
  done. An archived object's blobs can be deleted from a local CAS after a backup. The field
  follows the existing `option(true)` idiom (a presence-only flag) rather than
  `option(boolean)`, matching the convention already used elsewhere in the RTTI-typed schemas
  under `fs/types/rtti`.

Open design points:

- The future incremental-change format `application/vnd.fjs.change+json` (event log,
  most likely CRDT-based): its shape, and how it links to revisions — as a new media type,
  not as a field of this format (see the versioning rule above).
- Future `ref` forms beyond cbase32 hashes and `https://` bridge URLs (including the
  optional `{hash}-{nonce}` form for distinct subject identity), and which ref positions
  besides `parents` use the hash-only `hash` type rather than the general `ref`
  (`subject`? `snapshot`?).
- The exact syntax of a content-addressed revision reference (e.g.
  `{hash}.{generation}.{hash}` — `hash.generation` alone does not pin a version across
  branches; undefined for now — only hashes are used).
- Digital signatures for filtering changes from unknown users — a separate, future spec.
- Further out (subject for a separate spec): a `{public-key}/{name}.{generation}` form,
  where the key's owner defines what `{name}` means. Anchoring the identifier in a signer
  ties format identity to the web of trust (vision.md's `~/Alice/...` relative-path model)
  and solves the many-generations-from-many-users problem: the key prefix says whose
  evolution of `{name}` a blob follows.

### Tasks

- [ ] Create `fs/media/revision/README.md` — the spec of the format tagged
      `application/vnd.fjs.revision+json`
      (deployed automatically to functionalscript.com once it exists in the repo)
- [ ] Define `ref` as a URL in CA digital space, recognizing cbase32 hashes and `https://`
      bridge URLs for now, and `hash` as its hash-only subset
- [ ] Create `fs/media/revision/module.f.ts` with the RTTI schema for `revision`
      (`fs/types/rtti`), the `mediaType` constant, and its derived TS type
- [ ] Create `fs/cas/evo/module.f.ts` for the store-touching operations below, importing the
      format from `fs/media/revision`
- [ ] Implement head resolution: given `subject`, find revision(s) not listed as a parent
      by any other revision of the same `subject` (a reverse index scoped per subject; heads
      can be demoted retroactively by sync, but only by same-subject children)
- [ ] Implement content materialization: `snapshot` if present, otherwise the base
      (parent's materialization, or `subject` when `parents` is empty); reject a
      multi-parent revision without `snapshot`
- [ ] Implement (or specify) a merge tool that resolves concurrent heads into a new revision
      with multiple `parents` and a `snapshot`
- [ ] Tests: linear history, branch + merge, many heads for one subject, archived object,
      generation cache mismatch, first revision materializing from `subject`, a head demoted
      retroactively by a newly synced revision
- [ ] Teach the MCP server to surface a stored `mediaType` as the response `mimeType`
      (allowlisted `application/vnd.fjs.*+json` + schema validation, never a blind echo)
      instead of the generic text fallback, size-bounded to the 128 KiB inline cap so the
      metadata path stays O(1)-space for larger blobs — see
      [../mcp/todo/cas-get-mcp-resource-response.md](../mcp/todo/cas-get-mcp-resource-response.md)
- [ ] Later, as a separate spec: define the incremental-change format
      `application/vnd.fjs.change+json` (event log, likely CRDT-based) and how revisions
      link to it — a new media type, not a new field of this format
- [ ] Reference the format from `fs/cas/README.md`

### Related

- [fs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the `fs/media/` bucket this format's pure part lives in, and the cycle rule that puts it
  there
- `todo/plan/vision.md` — DISOT block types (signature, trust, license, redirect) this format
  sits alongside
- [66g-cas-verify-command](66g-cas-verify-command.md) — integrity checking applies equally to
  revision BLOBs
