## Observe socket backpressure directly

**Priority:** P2
**Status:** wip

### Problem

`createServer.pullsAtTheSocketsPace` compares the producer pull counts of two
independent paused connections after a fixed delay. Socket buffering and
scheduling vary between connections, so the comparison can fail while the pump
correctly waits for `drain`.

### Proposal

Observe the real response's `writableNeedDrain` flag at every producer pull and
assert that no pull happens while backpressure is pending. Keep the real paused
client and the assertion that departing clients release the response exactly once.

### Tasks

- [ ] Replace the cross-connection count comparison with a direct backpressure
      observation and verify that bypassing the drain wait fails the proof.

### Related

- [CI example](https://github.com/functionalscript/functionalscript/actions/runs/38013175281/job/114097551922?pr=2766)
  — the paused connections pulled five and ten chunks.
