# Coverage timing totals

**Status:** wip

Parallel coverage reports each file's duration, but does not show elapsed time
for the command or the sum of its child test-run durations.

Measure elapsed time from before discovery through final cache publication.
Sum executed child durations once per directory, including failures; cached
directories contribute zero. Reuse emergent testing's duration formatter.

## Tasks

- [ ] Carry measured child durations through planning results and aggregate them.
- [ ] Print elapsed and summed test-run times with the final coverage summary.
- [ ] Cover timing boundaries, parallel aggregation and warm-cache output; update
  runner and contributor documentation.
