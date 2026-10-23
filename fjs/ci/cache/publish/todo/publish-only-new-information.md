## Publish only new cache information

**Priority:** P3
**Status:** wip

### Problem

[`ci publish`](../module.f.mjs)'s `main` attempts a push even when this job
added no cache entries. If another job advanced the remote branch, this can
also create a temporary worktree and enter the merge loop unnecessarily.

### Proposal

Treat publication as an empty-commit check relative to the remote cache:
compare committed tree identities, and publish only when the local cache
contains new information.

Use the cache tip fetched for the job as the initial comparison. If its tree
is unchanged, return success without pushing or creating a worktree. After
merging a newer remote tip, skip another push if the resulting tree equals
that remote tree; a merge commit alone is not new cache information.

Checking only the last commit against its parent is insufficient: an all-hit
job still points to an older nonempty commit. The CAS writer already avoids
creating a commit when an entry exists.

### Tasks

- [ ] Skip publication when no new cache information was recorded.
- [ ] After merging, avoid publishing history-only changes.
- [ ] Verify all-hit jobs perform no push or worktree creation, while a new
      entry still publishes through the existing merge loop. Cover a concurrent
      writer that has already published the same information.

### Related

- [Smart CI](../../README.md)
