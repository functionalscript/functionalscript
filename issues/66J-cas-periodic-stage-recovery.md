# 66J-cas-periodic-stage-recovery. Periodic recovery of incomplete staged files

**Priority:** P3
**Status:** open

## Problem

The staging directory `~/.cas/.stage/` may accumulate incomplete uploads if the CAS service crashes or is killed mid-process. These files are orphaned and consume disk space indefinitely.

Additionally, if a user manually restarts the upload process for a partially staged file, or if multiple CAS services are running in parallel, we need a way to detect and resume/complete incomplete staged files.

## Proposal

Add a periodic background task (e.g., every hour or on startup) that:

1. **Scans `~/.cas/.stage/`** for staged files matching the pattern `${rnd}-${fileName}`.

2. **Attempts to recover each file**:
   - Read the file in chunks
   - Compute its content hash
   - Move the file to the final location `~/.cas/${hash}`

3. **Handles failure gracefully**:
   - If the file disappears before completion (another CAS service may have finished it), log and continue—this is not a critical error.
   - If hash computation fails, log the error and leave the file in staging for manual inspection/retry.

4. **Logs recovery actions** for observability (which files were recovered, how many bytes).

### Assumptions

- Multiple CAS services may run in parallel and share the same `~/.cas/` directory.
- Files can safely disappear from staging if another service completes the process.
- Manual intervention is not required for "missing file" errors.

## Tasks

- [ ] Define periodic task interface/scheduling (timer, cron-like, or manual trigger)
- [ ] Implement staged file scanner and recovery logic
- [ ] Reuse streaming hash computation from large-file upload
- [ ] Add logging/observability for recovery actions
- [ ] Handle concurrent writes (what if multiple services try to move the same file?)
- [ ] Add integration tests for recovery scenarios (normal completion, file disappears, hash failure)
- [ ] Document recovery behavior in `fs/cas/README.md`

## Related

- [i66J-cas-large-file-support](./66J-cas-large-file-support.md) — staging directory and streaming upload design
