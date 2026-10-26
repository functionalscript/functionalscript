## Make non-tail interpreter calls stack safe

**Priority:** P2
**Status:** open

### Problem

The EDAG interpreters still consume the JavaScript call stack when a
represented function calls another function whose result it must use before
returning. In [`settle`](../module.f.mjs), invoking that call enters another
body evaluator while the caller's evaluation remains on the host stack.
The `invoker` loop handles tail calls, but does not remove these pending
non-tail evaluations.

This is reachable with the compiler demo's Ackermann example:

```js
const ack = (m, n) => m === 0 ? n + 1
    : n === 0 ? ack(m - 1, 1)
        : ack(m - 1, ack(m, n - 1));
export default ack(2, 333);
```

The inner `ack(m, n - 1)` must finish before the outer call can run.
At `c25892f35`, this input overflows the host stack on Node and Chromium;
Bun can finish it. The depth at which evaluation fails depends on the host.
The expression graph itself is small: making analysis of deeply nested
graphs stack safe does not address this invocation depth.

[PR #3298](https://github.com/functionalscript/functionalscript/pull/3298)
contains the demo failure inside its output pane. It does not remove the
interpreter's dependence on the host call stack. This issue owns that
remaining defect, including calls through both
[`memo`](../../../memo/module.f.mjs) and
[`amnesia`](../../../amnesia/module.f.mjs).

### Proposal

Investigate representing pending non-tail evaluations explicitly rather
than retaining them as recursive host calls. Coordinate retained invocation
state with the interpreter resource-budget work so stack independence does
not turn runaway recursion into unbounded heap growth. Preserve evaluation
order, failure propagation, captured-value identity, memo sharing, and the
existing tail-call behavior.

### Tasks

- [ ] Trace non-tail invocation paths through the executors and shared
      operations, including calls made by runtime helpers.
- [ ] Design and implement explicit pending evaluations for those paths.
- [ ] Coordinate their retained state and work accounting with deterministic
      resource limits.
- [ ] Prove deep finite non-tail calls without depending on the host stack,
      with pending work after each call and nested calls in arguments.
- [ ] Prove evaluation order, thrown values, closure captures, memo sharing,
      and mixed tail/non-tail calls retain their existing behavior.

### Related

- [Graph traversal stack safety](../../../todo/stack-safety.md) owns recursion
  caused by expression graph depth.
- [Interpreter resource limits](../../../../compiler/todo/bound-edag-interpreter-resources.md)
  owns deterministic work and structure-growth budgets.
- [Review finding](https://github.com/functionalscript/functionalscript/pull/3298#discussion_r4372919188)
  identifies the missing ownership of non-tail invocation depth.
