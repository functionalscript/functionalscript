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

- **`fjs/media/revision/`** — the pure format: the RTTI schema, the `dialect` constant,
  encode/decode/validate, and the README spec. No store access, no effects. It must live
  under `fjs/media/` (see
  [fjs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md))
  because media-type detection has to import the schema to recognize revision blobs. The
  `fjs/media` detector should be able to identify a valid revision blob and return the
  derived media type `application/vnd.fjs.revision+json`.

Store-touching evolution operations (head resolution, materialization, and per-object
reverse indexes) are intentionally deferred. This issue only defines the revision type and
teaches media detection to recognize it; it does not add store-side evolution code and does
not materialize revisions.

```ts
export const revision = {
    /**
     * Format tag: names the dialect of this BLOB. Key order carries no
     * meaning: detection parses the JSON and validates the parsed value
     * against this schema, so the tag is recognized wherever it appears
     * in the object. The media type it is served with is derived:
     * `application/` + dialect + `+json`, i.e.
     * `application/vnd.fjs.revision+json`.
     */
    dialect: 'vnd.fjs.revision',

    /**
     * The subject of this revision: the identity of the mutable object
     * being revised ("subject" as in the subject of a certificate).
     * Any string — a pure identity, never a snapshot reference (see the
     * required-fields change, which removed the fallback role below).
     */
    subject: string,

    /**
     * Parent Revision BLOBs. Empty array means this is the first revision.
     *
     * Parent revisions are CAS blobs, so each parent is a hash.
     */
    parents: array(hash),

    /**
     * Complete materialized content (snapshot) of this revision.
     * Required — every revision states its content explicitly (see the
     * required-fields change), so a revision is interpretable in
     * isolation and there is no inheritance to resolve at read time.
     */
    snapshot: hash,

    /**
     * Generation number within the subject's evolution. Required.
     *
     * Correctness is existence + non-negative-integer only; a conforming
     * writer produces `0` for the first revision, else
     * `1 + max(parent.generation)`, but a deviation is an epoch-reset
     * signal, not an invalid blob (see the required-fields change).
     */
    generation: number,

    /**
     * Marks the mutable object as archived/inactive.
     *
     * The revision still exists; it is just hidden from normal active views.
     */
    archived: option(true),
} as const
```

Notes on the shape:

- `hash` is the only snapshot-reference type in this revision format. It is a cbase32
  native CAS address (see `fjs/basen/cbase32/`). Revision blobs do not accept `https://`
  bridge URLs or any other location-addressed reference form for CAS snapshot references:
  `parents` and `snapshot` always validate as hashes. `subject` is a pure identity string,
  never a snapshot reference, so it is never validated as a hash — any string is valid.
  **`snapshot` and `generation` are required** (the required-fields change made them so
  while no records existed): every revision states its content and generation explicitly,
  and is fully interpretable in isolation. The former snapshot-resolution algorithm —
  `subject`-as-fallback for zero parents, single-parent inheritance, multi-parent
  rejection — is gone; that inference now runs once at the write boundary in `fjs/cas/evo`'s
  `add`, which resolves an absent input `snapshot` and computes `generation` before writing
  every field explicitly.
- `dialect` is a self-describing format tag. In a generic CAS a blob is just bytes under a
  hash, so without a discriminant a reader can only recognize a revision by guessing from its
  shape, which collides with any other format that happens to have `subject`/`parents` fields.
  The tag gives format detection (tools can recognize revisions while walking a store) and,
  once the JSON is parsed, a cheap dispatch key selecting which dialect schema to validate
  against; the key doubles as the type discriminant. The value is a
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
  `fjs/media/revision` module (creating it is part of the tasks below; once in the repo it
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
  universal either. `fjs/media/` hosts formats from different vendors (`text/html`, plain
  `application/json`, …), and FS's own JavaScript-subset dialects cannot carry an embedded
  JSON tag at all — those keep the ordinary `fjs/media/type` detection path, are served as plain
  `text/javascript` (no `+javascript` suffix is registered, and JavaScript MIME types are
  a closed list nothing recognizes extensions of), and carry the same kind of short
  dialect name (`vnd.fjs.fjs`, `vnd.fjs.djs+vnd.fjs.fjs`) out of band. Out-of-band surfacing is
  transport-generic: a server that knows the dialect can always attach it alongside the
  payload, for example with a response field or header. The convention applies to **new JSON media
  types designed in FunctionalScript**, and even there it is a recommendation (a good
  default), not a requirement: such a format is a JSON object carrying a `dialect` key that
  names its dialect. Detection is semantic, not syntactic: the detector parses the JSON and
  validates the parsed value against the schema of the named dialect — **any** JSON that
  satisfies the schema is detected, regardless of key order, whitespace, or any other
  serialization detail; anything that does not validate falls through to normal media
  detection. This format adopts the convention. The key is spelled
  `dialect` — one vocabulary for both the embedded tag and the out-of-band field — and not:
  - `mimeType` — a common response field name. A response envelope stored back into CAS
    would carry a colliding key, inviting confusion between the envelope's transport
    metadata and the payload's format tag, and the value here is not a MIME type anyway.
  - `contentType` — echoes the HTTP header, and `content` is already a colliding term in
    many response envelopes.
  - `mediaType` — near-synonym of `mimeType`; serving both keys side by side in one
    response would invite exactly the confusion the vocabulary split is meant to prevent.
- **Media detection**: `fjs/media` should detect revision blobs by parsing the JSON and
  validating the parsed value against the revision RTTI schema, then report the derived
  media type `application/vnd.fjs.revision+json`. There is no byte-level shortcut: no
  assumption about key order, a `{"dialect":` prefix, or any other serialization detail —
  any JSON that satisfies the schema is a revision. The only limitation, for now, is size:
  parsing requires buffering the blob into a bit vector (`Vec`, `fjs/types/bit_vec`), so
  schema validation is attempted only when the blob is already buffered or within a
  size-bounded path such as the existing 128 KiB inline-content cap. Larger blobs fall
  back to the existing streaming detector so metadata-only reads remain size-independent.
  The size bound is an implementation limit of today's buffering parser, not part of the
  format; a future streaming parser/recognizer may lift it without changing the format or
  the detection contract, but detection must never regain byte-prefix assumptions to get
  there. This recognition is local to media detection; response shaping is out of scope for
  this issue and can be designed later once the pure detector exists.
- `subject` gives every revision of the same mutable thing a common anchor to resolve
  "current head(s)" against, without requiring a mutable pointer anywhere in CAS itself —
  the head is whatever revision(s) reference `subject` and are not listed as a parent by
  another revision *of the same `subject`* — a revision of a different subject referencing
  the same hash (or an unrelated blob imported by sync) must not demote a head. Subject
  identity is always an arbitrary string now that `snapshot` is required and never inferred
  from `subject`; a nonce-bearing subject such as `{hash}-{nonce}` is therefore always
  valid. Digital signatures (a separate, future spec) will filter changes from unknown
  users.
- `parents` is an array to support merges (multiple concurrent lines of history converging),
  matching the "multi-device / multi-user, merge freely" model in
  [vision.md](../../../todo/plan/vision.md).
- **Conflicting concurrent heads** are resolved the same way as in Git: a merge tool creates
  a new revision that references the conflicting revisions as `parents`. The format itself
  does not resolve conflicts; it records their resolution. CAS synchronization MUST never
  care about merge conflicts — a subject can legitimately have many heads in a store at any
  time. An application can propose a merge revision; sync just moves blobs.
- `generation`'s correctness is existence + non-negative-integer only. Equality with
  `1 + max(parents' generations)` (or `0` for a root) is what a conforming writer produces,
  but it is observed, not enforced: a deviation is an epoch-reset signal, not an invalid
  blob (see the required-fields change). Ordering by `generation` is reliable within an
  epoch; the one-level comparison against parents is the epoch-boundary detector.
- `archived` signals that we no longer work with the object — for example, a task that is
  done. An archived object's blobs can be deleted from a local CAS after a backup. The field
  follows the existing `option(true)` idiom (a presence-only flag) rather than
  `option(boolean)`, matching the convention already used elsewhere in the RTTI-typed schemas
  under `fjs/types/rtti`.

Open design points:

- The future incremental-change dialect `vnd.fjs.change` (event log, most likely
  CRDT-based): its shape, and how it links to revisions — as a new dialect, not as a field
  of this format (see the versioning rule above).
- Future snapshot-reference forms beyond cbase32 hashes. Subject identity strings can already
  use any non-hash form, since `subject` is never a snapshot reference.
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

- [x] Create `fjs/media/revision/README.md` — the spec of the dialect `vnd.fjs.revision`,
      served as `application/vnd.fjs.revision+json`
      (deployed automatically to functionalscript.com once it exists in the repo)
- [x] Define `hash` as the only snapshot-reference type accepted by this dialect, recognizing
      cbase32 native CAS addresses and rejecting `https://` bridge URLs for `parents`,
      `snapshot`, and zero-parent fallback `subject` references
- [x] Create `fjs/media/revision/module.f.ts` with the RTTI schema for `revision`
      (`fjs/types/rtti`), the `dialect` constant, and its derived TS type
- [x] Teach `fjs/media` detection to recognize valid revision JSON — by parsing and RTTI
      schema validation, with no key-order or byte-prefix assumptions — and return the
      derived media type `application/vnd.fjs.revision+json`, falling through to the
      existing detector for unknown dialects or invalid revision blobs
- [x] Tests: valid revision detection, invalid revision fallthrough, `https://` bridge URL
      rejection in `parents` and `snapshot`, arbitrary string `subject` acceptance (now
      that `subject` is a pure identity, never a snapshot reference), missing/non-integer/
      negative `generation` and missing/non-hash `snapshot` rejection, size-bounded schema
      validation with large blobs falling through to the streaming detector, key-order
      independence (a valid revision whose `dialect` key is not first must still be
      detected), and ordinary JSON fallback behavior (updated by the required-fields change)
- [ ] Later, as a separate spec: define the incremental-change dialect `vnd.fjs.change`
      (event log, likely CRDT-based) and how revisions link to it — a new dialect, not a
      new field of this format
- [x] Reference the format from `fjs/cas/README.md`

### Related

- [fjs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the `fjs/media/` bucket this format's pure part lives in, and the cycle rule that puts it
  there
- `todo/plan/vision.md` — DISOT block types (signature, trust, license, redirect) this format
  sits alongside
- [66g-cas-verify-command](66g-cas-verify-command.md) — integrity checking applies equally to
  revision BLOBs
