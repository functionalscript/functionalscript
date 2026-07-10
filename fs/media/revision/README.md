# Revision media format

`fs/media/revision` defines the FunctionalScript revision dialect,
`vnd.fjs.revision`, served as `application/vnd.fjs.revision+json`.

A revision blob is a JSON object that records one immutable step in the evolution
of a logical mutable object. The first serialized key is always `dialect`, which
lets tagged-JSON detectors cheaply recognize the blob before validating the full
schema.

```json
{
  "dialect": "vnd.fjs.revision",
  "subject": "<ref>",
  "parents": ["<hash>"],
  "snapshot": "<ref>",
  "generation": 1,
  "archived": true
}
```

## Fields

- `dialect` is the literal `vnd.fjs.revision`. Compatible additive extensions keep
  this dialect. Incompatible changes must use a new dialect instead of a `version`
  field.
- `subject` is the stable identity of the mutable object being revised. It is a
  content-addressed-space ref: either a native cBase32 SHA-256 CAS hash or an
  `https://` bridge URL.
- `parents` lists parent revision blob hashes. Parent refs are hash-only because a
  parent revision must be present as a CAS blob; an `https://` bridge URL is not a
  valid parent.
- `snapshot`, when present, is the complete materialized content ref for this
  revision. Incremental diffs are intentionally not part of this dialect; they
  require a separate future dialect such as `vnd.fjs.change`.
- `generation` is an optional cache. Consumers that use it for untrusted blobs must
  verify it against the parent chain.
- `archived`, when present as `true`, marks the object inactive without deleting
  its history.

## Materialization

A revision materializes to `snapshot` when present. Otherwise it materializes to
its base: the single parent revision's materialization, or `subject` for a first
revision with no parents. A multi-parent merge revision must carry `snapshot`
because there is no single base to inherit.

## Head resolution

For a subject, heads are active revisions of that same subject that are not listed
as a parent by another revision of the same subject. Children from a different
subject never demote a head, even when they mention the same parent hash.

## Format/store split

This directory contains only the pure media format. Store operations such as head
resolution and materialization over a revision index live in `fs/cas/evo` so media
detection can import this format without forming a `cas` dependency cycle.
