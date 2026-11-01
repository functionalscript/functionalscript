## Preserve owning self tail calls through loop helpers

**Priority:** P2
**Status:** open

### Problem

A source self tail call inside a loop can become a call through a generated
helper's capture. Output recovery then misses the owning function's tail call
and emits recursive JavaScript that grows the stack:

```javascript
const f = n => {
    while (true) {
        if (n === 0) { return 0 }
        return f(n - 1)
    }
}
export default f
```

At parent commit `87074e08b`, general JavaScript output contains a helper that
captures `f` and calls it. Calling the exported function with `100_001` raises
`RangeError`. The failure also reproduces after removing synthetic terminal-loop
throws; it predates that correction.

### Tasks

- [ ] Preserve the owning self tail call across loop-helper construction and
      common output recovery.
- [ ] Emit `while` for these tail calls in JavaScript and Rust, preserving
      selected work, arguments, captures and iteration lifetimes.
- [ ] Cover deep execution for the example and for loops with local state
      before their owning self tail call.

### Related

- [Loop construction](../../loops.md).
- [Compiler architecture](../../../../compiler/architecture.md).
- [Session](https://chatgpt.com/local/01a1908b-f970-713f-b7cb-e16f7ffb2006).
