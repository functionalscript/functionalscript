# 66P-cas-upload-via-write. Reimplement `casUpload` on top of `cas.write()` + delete the source

**Priority:** P3
**Status:** open

## Problem

`casUpload` (`fs/cas/module.f.ts`) re-implements its own move-hash-move staging
pipeline (`random256` → `mkdir` → `rename` source into `_stage/<deadline>-<rand>`
→ `streamHash` → `mkdir` → `rename` to the final shard). This duplicates the
lock-free staging logic that already lives in `fileCas.write`:

| Concern | `fileCas.write` | `casUpload` (duplicated) |
|---------|-----------------|--------------------------|
| Staging name `<deadline>-<random256>` | yes | yes |
| Lease renewal after each chunk | yes | no (single `streamHash` pass) |
| Expired-staging GC (`gcStage`) | yes | no |
| Publish-by-`rename` + dedup/repair of a same-content shard | yes | partial (plain `rename`, no replace semantics) |
| Post-publish `stat` size check | yes | no |

Because the two paths diverge, every correctness fix to the upload pipeline
(lease GC, size verification, dedup-on-publish, future symlink/chmod hardening)
has to be applied twice, and `casUpload` already lags behind `write`.

## Proposal

Replace the body of `casUpload` with a thin wrapper around the existing
streaming `cas.write()`:

1. Open the source file (`~/cas_upload/<fileName>`) as a chunk stream
   (`ListEffect<O, IoResult<Vec>>`) — the same shape `fileCas.read` already
   produces, just rooted at an arbitrary path instead of a shard path.
2. Feed that stream into `cas.write(payload)`, inheriting all of its
   correctness properties (lease GC, lease renewal, dedup-on-publish, size
   check) for free.
3. **If — and only if — `write` returns `ok(hash)`, delete the source file**
   (`rm(src)`). On an `error` result the source is left in place so the upload
   can be retried; `write` already cleans up its own partial staging file.

This turns `casUpload` from a *move* (the original disappears the moment it is
renamed into staging) into a *copy-then-delete*: the original stays intact until
the content is durably published under its hash, and is only removed after a
successful write. It also collapses two staging implementations into one.

### Trade-off to note in the issue, not block on

The original pipeline `rename`s the source into staging — one cheap, atomic
metadata operation on the same filesystem. The `write`-based pipeline reads the
source and writes a fresh staging copy (extra I/O, and transiently ~2× disk for
the file). For the `~/cas_upload/` workflow this is acceptable: correctness and
a single staging implementation outweigh the copy cost, and the source is freed
immediately after publish. If the copy cost ever matters, a fast-path `rename`
can be reintroduced *inside* `write` later without changing `casUpload`.

## Tasks

- [ ] Extract a generic "stream a file path as `ListEffect<O, IoResult<Vec>>`"
      helper from `fileCas.read`'s chunk loop (it currently hard-codes the shard
      path) so an arbitrary source path can be streamed.
- [ ] Reimplement `casUpload` to build that source stream and pass it to
      `cas.write()`; drop the bespoke `random256`/`streamHash`/double-`rename`
      staging code.
- [ ] On `ok(hash)`, `rm` the source file; on `error`, leave the source in
      place and return the error.
- [ ] Update `casUpload`'s effect signature and its JSDoc (the "move-hash-move"
      description no longer applies — it is now copy-via-`write`-then-delete).
- [ ] Update the MCP `cas_add { type:'url' }` caller in
      `fs/cas/mcp/module.f.ts` only if the signature changes.
- [ ] Add/adjust proofs in `fs/cas/proof.f.ts` covering: successful upload
      deletes the source; a failed write leaves the source untouched.

## Related

- [i66K-cas-cli-mcp-shared-upload](./66K-cas-cli-mcp-shared-upload.md) — shared
  upload logic between CLI and MCP; this issue removes the duplicated staging
  half of that overlap by routing through `write`.
- [cas/staging-lease.md](./cas/staging-lease.md) — the lease/GC design that
  `casUpload` should inherit by delegating to `write`.
- [cas/staging.md](./cas/staging.md) — "Compatibility with the existing
  `casUpload` path"; this issue resolves that divergence.
