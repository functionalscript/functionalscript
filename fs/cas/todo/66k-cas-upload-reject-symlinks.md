## 66K-cas-upload-reject-symlinks. Reject symlinks before moving them into CAS

**Priority:** P2
**Status:** open

### Problem

When the upload source in `~/cas_upload/` is a symlink, `rename(src, stagePath)`
moves the link itself rather than the target. `readBytes(stagePath)` then hashes
the target's contents, but the final CAS object at `~/.cas/<hash>` remains a
symlink.

This breaks two CAS invariants:

- **Immutability** — `cas get` / `readFile` follows the symlink at read time, so
  the bytes returned for a stored hash can change if the target is modified or
  replaced.
- **Confinement** — the link can point outside `~/cas_upload/`, bypassing any
  path restriction.

### Proposal

Before the first `rename`, verify that the source is a regular file. Two options:

1. **`lstat` check** — add an `lstat` effect that returns file-type metadata
   without following the link; reject if `isSymbolicLink()` is true. Fast and
   leaves the file in place on rejection.

2. **Materialize** — copy the dereferenced bytes into a fresh regular file in
   staging, then delete the original symlink. Avoids needing a new primitive but
   costs an extra read/write for every upload.

Option 1 is preferred: it catches the problem early with minimal overhead and
keeps the move-hash-move pipeline atomic.

### Tasks

- [ ] Add `lstat` effect (or extend `access`/`stat`) to expose `isSymbolicLink`
- [ ] In `cas upload`, call `lstat` on `src` before `rename`; return an error if
      it is a symlink or any non-regular-file type
- [ ] Add proof test: uploading a symlink must fail before touching staging

### Related

- [i66J-cas-streaming-upload-design](todo.md) — the upload pipeline where this issue arises
