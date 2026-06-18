# 66J-cas-streaming-upload-design. Streaming upload design for large files

**Priority:** P3
**Status:** open

## Problem

Related to [i66J-cas-large-file-support](./66J-cas-large-file-support.md): storing files in memory before computing their hash is infeasible for large files (GBs+).

## Proposal

Two-phase staged move for `cas_upload_dir` (or `cas_add` with restricted paths):

1. **Move from `~/cas_upload/` to staging**: File is atomically moved from `~/cas_upload/${fileName}` to `~/.cas/.stage/${rnd}-${fileName}`, where `rnd` is a random 256-bit number in CBase32.

2. **Stream-hash the staged file**: Read the file in chunks (e.g., 64 KB blocks) and incrementally compute the content hash, avoiding large memory allocations.

3. **Move to final location**: Once hash is computed, rename the staged file to `~/.cas/${hash}` (or appropriate layout).

### Rationale

- **Move vs. copy**: Fast—no data duplication. Files in `~/cas_upload/` exist *only* to be uploaded; once moved to staging, they're committed to the process.

- **Staging before hashing**: Prevents time-of-check-time-of-use (TOCTOU) races where the file could be modified between hash computation and final move.

- **Randomized staging names**: Avoids collisions between concurrent uploads.

- **Local staging instead of `/tmp`**: Supports recovery if the upload is interrupted—staged files remain available for cleanup or resumption.

### Cleanup & Recovery

- **Abandoned staged files**: Add a background job or CLI command to clean up `~/.cas/.stage/` after a timeout (e.g., 24 hours).
- **Failed hashes**: If hash computation fails, leave the file in staging with an error logged; manual cleanup or retry is explicit.
- **Resumable uploads** (future): Staged files could be resumed if the process is killed mid-stream.

## Tasks

- [ ] Define streaming hash-computation interface (read in chunks, accumulate hash)
- [ ] Add `RND` effect for 256-bit random numbers in CBase32
- [ ] Implement `cas_upload_dir` command that orchestrates the move-hash-move pipeline
- [ ] Define `~/.cas/.stage/` layout and cleanup policy
- [ ] Add error handling and logging for each phase
- [ ] Document the upload flow in `fs/cas/README.md`
- [ ] Add integration tests for interrupted uploads and cleanup

## Related

- [i66J-cas-large-file-support](./66J-cas-large-file-support.md) — remove 131 KB limit
- [i66J-cas-add-path-restriction](./66J-cas-add-path-restriction.md) — restrict paths to approved directories
