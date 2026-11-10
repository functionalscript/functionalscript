## Run isolated coverage children concurrently

**Priority:** P2
**Status:** wip

### Problem

Coverage currently waits for each child before starting the next. Run multiple
independent directories at once, with concurrency inferred from available
system CPUs and no command-line scheduling flag.

### Tasks

- [ ] Expose available CPU parallelism as a system-information effect.
- [ ] Execute bounded parallel batches after planning and the cache lookup.
- [ ] Print complete start and finish lines for each measured file, keeping a
      failed result and its captured logs together.
- [ ] Preserve cache validation, quiet hits, failure continuation, and the
      single final save/synchronization barrier; prove real child overlap.
