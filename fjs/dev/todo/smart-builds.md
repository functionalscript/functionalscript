## Investigate smart builds on developer machines

**Priority:** P3
**Status:** open

### Problem

The [build cache](../../ci/todo/097-smart-ca-ci.md) decides the direction
for a developer machine: it runs the same generated steps as CI.
`fjs run`, later and lower priority, picks the jobs for the host's
platform, runs their steps in the workflow's order, and publishes on
success, with the toolset and the files as they are recorded in the key
rather than validated. What that leaves open is
whether a developer's everyday work is served by running CI's jobs, and
where it is not.

### Scope

This task records findings and open questions about the developer
workflow around that direction; the design of the cache, the job and the
command is the build cache's and is not redone here.

### Tasks

- [ ] Examine local build and check workflows and identify repeated work
      that a CI job's entry would not cover — a subtree's tests, a single
      module's coverage, the compile of one file.
- [ ] Record which of CI's assumptions a developer machine breaks beyond
      the ones the build cache already handles — uncommitted inputs and an
      unpinned toolset are recorded, not refused — and what each costs.
- [ ] Record findings, limitations, and questions for the per-task
      entries and the dependency graph the build cache plans next.

### Related

- [CI build cache](../../ci/todo/097-smart-ca-ci.md) — decides the
  direction: a developer machine runs the same steps, through `fjs run`.
