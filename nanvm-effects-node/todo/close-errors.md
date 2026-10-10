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
operation as a failed `close`, and the file stays, as the Node handler leaves it
after a failed close; `writeExclusive` removes its file only for a failed write.
A local filesystem reports these errors from `write` already, so the sync is not
observable in a test there; it is one call in the one place a close error can be
seen, and both outcomes are proved through injected failures.

### Tasks

- [x] `createExclusive` and `writeExclusive`.
- [ ] `writeFile` and `writeBytes`, which go through `fs::write` and a dropped
      `File`: sync them the same way.
