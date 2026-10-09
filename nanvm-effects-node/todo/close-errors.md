## Report an error a filesystem defers to `close`

**Priority:** P4
**Status:** open

### Problem

`writeExclusive`, `createExclusive` and the other file writes of
[`files.rs`](../src/files.rs) drop a `std::fs::File`, and `std` discards the
error `close(2)` reports. A filesystem that defers a write-back failure, such as
`EIO` or `ENOSPC` on NFS or a FUSE quota, tells its caller only there. The Node
handler `await`s `fh.close()` and so reports it, as `writeExclusive` in
`fjs/effects/node/module.mjs` shows; the native one answers `ok` for a file
whose complete contents are not established.

On a local filesystem the error surfaces from `write` instead, which is
reported, so the case needs a deferring filesystem and is far from ordinary.

### Proposal

`std` has no fallible close. The ways to see the error are `File::sync_all`
before the drop, which also forces the data to disk and so costs a flush the
Node handler does not make, or closing the raw descriptor through FFI, which
needs `unsafe` and a platform layer for a crate that has neither. Neither is
free, so pick one deliberately; do not take the flush without deciding it is
the contract.

### Tasks

- [ ] Decide between `sync_all` and a descriptor close, or accept and document
      the divergence.
- [ ] Apply it to every operation that writes a file, with a test that fails
      the close where a platform allows one.
