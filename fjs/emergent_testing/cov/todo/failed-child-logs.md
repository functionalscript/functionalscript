## Show failed coverage children's logs

**Priority:** P1
**Status:** wip

### Problem

Quiet coverage discards child stdout and stderr even on failure. Preserve
successful runs' concise progress while showing the failed child's native
proof diagnostics and coverage report without rerunning it.

### Tasks

- [ ] Add structured process capture preserving exit status and both output
      streams, including trailing UTF-8 output.
- [ ] Replay captured output after a failed child's progress result and command.
- [ ] Prove successful runs remain quiet, failed output is retained, large
      streams drain, and later directories continue after failures.
