# Merge concurrent cache pushes

**Priority:** P2
**Status:** wip

## Problem

The success cache in #3227 gives each CI job one push. Concurrent writers
advance `build-cache` after another job fetched it, so rejected pushes lose
successful checks. Run 40016215099 published Windows ARM's Rust result while
rejecting Node's TypeScript and compile results and Ubuntu Intel's Rust result.

## Plan

Publish with at most ten push attempts. After a rejected push, fetch the remote
cache, merge its immutable entries in a temporary cache worktree, and retry.
Keep network commands in the source checkout for checkout's credentials and
keep the source branch and index untouched. Publishing stays best effort.

## Tasks

- [ ] Implement the bounded merge loop and wire it into the generated jobs.
- [ ] Prove successful publication, retries and failure propagation; exercise
      real concurrent writers from shallow clones.
- [ ] Update the cache lifecycle documentation.
