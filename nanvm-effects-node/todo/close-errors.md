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
operation and the file stays, as it does when the Node handler's `close`
fails; only a failed *write* is rolled back. `writeFile` and `writeBytes` take arbitrary paths, which may be a pipe, a terminal
or a device: those cannot be synced and answer `EINVAL` or `Unsupported`, which
the helper treats as nothing to flush, since a Node `close` of them succeeds. A
local filesystem reports these errors from `write` already, so the
sync is not observable in a test there; it is a call in the one place a close
error can be seen. A Windows console answers `ERROR_INVALID_HANDLE`, which Rust
does not categorize, and is nothing to flush as well.

### Tasks

- [x] `createExclusive` and `writeExclusive`.
- [x] `writeFile` and `writeBytes`, through the one `sync` helper in `files.rs`; the exclusive operations keep
      raw `sync_all`, since the file they create is regular and every sync error
      there is real.
