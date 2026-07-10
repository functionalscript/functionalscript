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
change in disguise. Incremental changes will arrive later as their own dialect
(`vnd.fjs.change`, served as `application/vnd.fjs.change+json`; see the versioning rule
below), not as a field of this one.

The first implementation step is deliberately limited to the pure format and media
recognition:

- **`fs/media/revision/`** — the pure format: the RTTI schema, the `dialect` constant,
  encode/decode/validate, and the README spec. No store access, no effects. It must live
  under `fs/media/` (see
  [fs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md))
  because media-type detection has to import the schema to recognize revision blobs. The
  `fs/media` detector should be able to identify a valid revision blob and return the
  derived media type `application/vnd.fjs.revision+json`.

Store-touching evolution operations (head resolution, materialization, per-object reverse
indexes, MCP resource behavior) are intentionally deferred. This issue only defines the
revision type and teaches media detection to recognize it; it does not add an `fs/cas/evo`
module and does not materialize revisions.

```ts
export const revision = {
    /**
     * Format tag: names the dialect of this BLOB. Must be the first key
     * in the serialized JSON so detection can match the `{"dialect":"`
     * prefix. The media type it is served with is derived:
     * `application/` + dialect + `+json`, i.e.
     * `application/vnd.fjs.revision+json`.
     */
    dialect: 'vnd.fjs.revision',

    /**
     * The subject of this revision: the identity of the mutable object
     * being revised ("subject" as in the subject of a certificate).
     */
    subject: hash,

    /**
     * Parent Revision BLOBs. Empty array means this is the first revision.
     *
     * Parent revisions are CAS blobs, so each parent is a hash.
     */
    parents: array(hash),

    /**
     * Complete materialized content (snapshot) of this revision.
     *
     * If absent, the revision materializes to its base: the parent's
     * materialization, or `subject` itself for a first revision.
     */
    snapshot: option(hash),

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

- `hash` is the only reference type in this first revision format. It is a cbase32 native
  CAS address (see `fs/basen/cbase32/`). Revision blobs do not accept `https://` bridge
  URLs or any other location-addressed reference form: `subject`, `parents`, and `snapshot`
  all validate as hashes. Future non-hash reference forms, if needed, belong in a later
  dialect or a separate design so v1 readers never silently accept references they cannot
  resolve as CAS blobs.
- `dialect` is a self-describing format tag. In a generic CAS a blob is just bytes under a
  hash, so without a discriminant a reader can only recognize a revision by guessing from its
  shape, which collides with any other format that happens to have `subject`/`parents` fields.
  The tag gives format detection (tools can recognize revisions while walking a store) and a
  cheap pre-validation gate; the key doubles as the type discriminant. The value is a
  **short dialect name** in the RFC 6838 vendor-tree style (`vnd.fjs.revision`); the media
  type the blob is served with is derived mechanically — `application/` + dialect + `+json`,
  here `application/vnd.fjs.revision+json` — because the `application/` top level and the
  RFC 6839 `+json` structured-syntax suffix are already implied by the file being JSON. Any
  system that does not know the dialect still has the correct generic fallback:
  `application/json`. A dialect name may itself be a `+`-separated **fall-back chain**,
  most specific first (e.g. DJS, a subset of FJS, is `vnd.fjs.djs+vnd.fjs.fjs`); the
  derivation appends `+json` as the final fall-back, and since only the final suffix of a
  media type is standardized, the derived type remains a conformant `*+json` type whatever
  the chain. No registry entry is required for the vendor tree, the string is
  stable (no mutable URL, no DNS anchoring), and it is validated by the schema itself since
  the literal is part of the schema. The format spec lives in the `README.md` of the
  `fs/media/revision` module (creating it is part of the tasks below; once in the repo it
  is automatically deployed to functionalscript.com) — the spec is referenced by the
  schema/docs rather than encoded in the tag value. **Versioning rule:** additive,
  compatible changes keep the tag — RTTI struct validation accepts undeclared keys by
  design, so a blob with extra fields still validates against the v1 schema, and that is
  the intended forward-compatibility path. An **incompatible** change MUST NOT reuse the
  tag: it introduces a new dialect (for example `vnd.fjs.revision2`), so readers of the old
  format never validate — and never silently misread — a blob of the new one. The tag is
  therefore the version discriminant for breaking changes; no `version` field is needed.
  This rule is why an earlier draft's optional `changes` field (incremental diffs replayed
  over the base) was dropped: it is *schema*-additive but *semantically* breaking — a v1
  reader would still validate such a blob and materialize the base, silently ignoring the
  changes. Incremental changes are therefore a future separate dialect, `vnd.fjs.change` —
  `snapshot` vs `change` is the standard snapshot/delta dichotomy of event-sourced systems.
- **Tagged-JSON detection convention** — the tag is not revision-specific, but it is not
  universal either. `fs/media/` hosts formats from different vendors (`text/html`, plain
  `application/json`, …), and FS's own JavaScript-subset dialects cannot carry an embedded
  JSON tag at all — those keep the ordinary `fs/mime` detection path, are served as plain
  `text/javascript` (no `+javascript` suffix is registered, and JavaScript MIME types are
  a closed list nothing recognizes extensions of), and carry the same kind of short
  dialect name (`vnd.fjs.fjs`, `vnd.fjs.djs+vnd.fjs.fjs`) out of band. Out-of-band surfacing is
  transport-generic: a server that knows the dialect can always attach it — an additional
  `dialect` field in MCP responses (MCP permits extra fields) or a `Dialect` header in
  HTTP responses. The convention applies to **new JSON media
  types designed in FunctionalScript**, and even there it is a recommendation (a good
  default), not a requirement: such a format MAY be a JSON object whose **first** key is
  `dialect`, so detection matches the byte prefix `{"dialect":"vnd.fjs.` and then
  validates against the schema of the named dialect; anything that does not match falls
  through to normal media detection. This format adopts the convention. The key is spelled
  `dialect` — one vocabulary for both the embedded tag and the out-of-band field — and not:
  - `mimeType` — the field name MCP JSON uses at top level: resource contents are
    `{ uri, mimeType, text | blob }` and our own `cas_get` tool result is
    `{ length, mimeType, type[, uri] }` (see
    [../mcp/todo/cas-get-mcp-resource-response.md](../mcp/todo/cas-get-mcp-resource-response.md)).
    Any such response stored back into CAS would false-positive a `{"mimeType":` prefix
    sniff, and the value here is not a MIME type anyway.
  - `contentType` — echoes the HTTP header, and `content` is already a colliding term in
    MCP (`CallToolResult.content`), the very reason `cas_get` renamed its `content` key away.
  - `mediaType` — near-synonym of `mimeType`; serving both keys side by side in one
    response would invite exactly the confusion the vocabulary split is meant to prevent.
- **Media detection**: `fs/media` should detect revision blobs by the embedded dialect tag and
  schema validation, then report the derived media type `application/vnd.fjs.revision+json`.
  This recognition is local to media detection; CAS/MCP response shaping is out of scope
  for this issue and can be designed later once the pure detector exists.
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
- **Future materialization algorithm** — out of scope for the first detector-only change.
  The intended rule is that the base of a revision is its materialized parent, or `subject`
  itself when `parents` is empty: if `snapshot` is present, use it; otherwise, use the base.
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

- The future incremental-change dialect `vnd.fjs.change` (event log, most likely
  CRDT-based): its shape, and how it links to revisions — as a new dialect, not as a field
  of this format (see the versioning rule above).
- Future reference forms beyond cbase32 hashes (including the optional `{hash}-{nonce}`
  form for distinct subject identity), if a later dialect needs them.
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

- [ ] Create `fs/media/revision/README.md` — the spec of the dialect `vnd.fjs.revision`,
      served as `application/vnd.fjs.revision+json`
      (deployed automatically to functionalscript.com once it exists in the repo)
- [ ] Define `hash` as the only reference type accepted by this dialect, recognizing
      cbase32 native CAS addresses and rejecting `https://` bridge URLs
- [ ] Create `fs/media/revision/module.f.ts` with the RTTI schema for `revision`
      (`fs/types/rtti`), the `dialect` constant, and its derived TS type
- [ ] Teach `fs/media` detection to recognize valid revision JSON and return the derived
      media type `application/vnd.fjs.revision+json`, falling through to the existing
      detector for unknown dialects or invalid revision blobs
- [ ] Tests: valid revision detection, invalid revision fallthrough, `https://` bridge URL
      rejection in `subject`, `parents`, and `snapshot`, first-key `dialect` prefix matching,
      and ordinary JSON fallback behavior
- [ ] Later, as a separate spec: define the incremental-change dialect `vnd.fjs.change`
      (event log, likely CRDT-based) and how revisions link to it — a new dialect, not a
      new field of this format
- [ ] Reference the format from `fs/cas/README.md`

### Related

- [fs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the `fs/media/` bucket this format's pure part lives in, and the cycle rule that puts it
  there
- `todo/plan/vision.md` — DISOT block types (signature, trust, license, redirect) this format
  sits alongside
- [66g-cas-verify-command](66g-cas-verify-command.md) — integrity checking applies equally to
  revision BLOBs
