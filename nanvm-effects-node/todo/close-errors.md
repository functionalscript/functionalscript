## Report an error a filesystem defers to `close`

**Priority:** P3
**Status:** open

### Problem

`std` discards the error `close(2)` reports when a `std::fs::File` is dropped. A
filesystem that defers a write-back failure, such as `EIO` or `ENOSPC` on NFS or
a FUSE quota, tells its caller only there. The Node handler `await`s
`fh.close()` and so reports it; a native write that drops the file answers `ok`
for contents that are not established.

### Decision

Sync before the drop: `File::sync_all` reports what the close would, with no
`unsafe` and no platform layer. It also forces the data to disk, a flush the
Node handler does not make; that cost is accepted for the operations below.

`createExclusive` and `writeExclusive` do it. A sync that fails fails the
operation, and `writeExclusive` rolls its file back as it does for a failed
write. A local filesystem reports these errors from `write` already, so the
sync is not observable in a test there; it is a call in the one place a close
error can be seen, written so that its failure takes the path a write failure
takes, which the rollback test exercises.

### Tasks

- [x] `createExclusive` and `writeExclusive`.
- [ ] `writeFile` and `writeBytes`, which go through `fs::write` and a dropped
      `File`: sync them the same way.
