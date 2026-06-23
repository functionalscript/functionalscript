## 66J-cas-large-file-support. Support files larger than 131 KB via streaming upload

**Priority:** P3
**Status:** wip

### Problem

CAS currently has a hard limit of 131 KB per file and stores content in memory before computing hashes. This prevents storing practical file sizes:
- Binary artifacts (compiled executables, archives)
- High-resolution images
- Video thumbnails
- Large datasets or JSON exports
- Generated code files

Storing files in memory is infeasible for large files (GBs+), and the 131 KB artificial ceiling must be removed or significantly increased.

### Proposal

Two-phase staged move for `cas upload` (or `cas_add` with restricted paths):

1. **Move from `~/cas_upload/` to staging**: File is atomically moved from `~/cas_upload/${fileName}` to `~/.cas/.stage/${rnd}-${fileName}`, where `rnd` is a random 256-bit number in CBase32.

2. **Stream-hash the staged file**: Read the file in `maxLengthBytes` (128 KiB) chunks via `readBytes` and incrementally compute the SHA-256 hash, avoiding large memory allocations.

3. **Move to final location**: Once hash is computed, rename the staged file to `~/.cas/<shard>/<hash>` using the existing sharded layout.

#### Rationale

- **Move vs. copy**: Fast—no data duplication. Files in `~/cas_upload/` exist *only* to be uploaded; once moved to staging, they're committed to the process.

- **Staging before hashing**: Prevents time-of-check-time-of-use (TOCTOU) races where the file could be modified between hash computation and final move.

- **Randomized staging names**: Avoids collisions between concurrent uploads.

- **Local staging instead of `/tmp`**: Supports recovery if the upload is interrupted—staged files remain available for cleanup or resumption.

#### Cleanup & Recovery

- **Abandoned staged files**: Add a background job or CLI command to clean up `~/.cas/.stage/` after a timeout (e.g., 24 hours).
- **Failed hashes**: If hash computation fails, leave the file in staging with an error logged; manual cleanup or retry is explicit.
- **Resumable uploads** (future): Staged files could be resumed if the process is killed mid-stream.

### Tasks

- [x] Add `randomInt`, `readBytes`, and `rename` primitives to `fs/effects/node`
- [x] Implement `random256` helper — 8 × `randomInt` calls folded into a 256-bit `Vec`
- [x] Implement `streamHash` — chunk-loop over `readBytes` feeding an incremental `Sha2` state
- [x] Add `cas upload <fileName>` command that orchestrates the move-hash-move pipeline
- [x] Add proof tests: happy path, upload-then-get roundtrip, wrong args, missing source file
- [ ] Reject symlinks in `~/cas_upload/` before the first rename (i66K-cas-upload-reject-symlinks)
- [ ] `cas get` is still limited by `readFile`'s 128 KiB cap — return path/URL instead (i66K-cas-get-return-path)
- [ ] Define cleanup policy and CLI command for `~/.cas/.stage/` abandoned files
- [ ] Document the upload flow in `fs/cas/README.md`

### Related

- [i66K-cas-upload-reject-symlinks](todo.md) — reject symlinks before staging
- [i66K-cas-get-return-path](todo.md) — `cas get` should return path/URL for large-file support
