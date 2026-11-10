## Keep coverage cache hits quiet

**Priority:** P2
**Status:** wip

### Problem

Printing a path with `...Cached` for every reused module hides the work actually
running. Cache hits should contribute only to the cached count in the final
coverage summary. Executed modules retain progress and failure diagnostics.

### Tasks

- [ ] Remove per-file cache-hit reporting and preserve the summary counts.
- [ ] Verify cold, warm, mixed and synchronized cache runs keep their behavior.
