## Reconcile Object.entries without a static runtime provider

**Priority:** P3
**Status:** open

### Problem

The represented executor answers `Object.entries` natively without a runtime.
Generated Rust reads it through `static_read`, which unconditionally asks
`runtime.static`. A missing provider therefore fails before the native function
can be called. The canonical runtime works in both executors.

The minimal EDAG is:

```javascript
['()', ['Object.entries'], [['{}', [[':', 'a', 1]]]]]
```

The represented result without a runtime is `[['a', 1]]`; generated Rust given
`Any::undefined()` as its runtime fails. This predates object-spread return
lifting: its generated Rust and the static-read implementation are unchanged
from the earlier base. Object-spread validation compares ordered own properties
directly across runtime profiles and uses the canonical runtime for explicit
`Object.entries` calls.

### Tasks

- [ ] Pin the intended missing-provider contract for this native-only static.
- [ ] Align the executor adapters and add a shared regression fixture.

### Related

- [Static reads](../mod.rs) — the unconditional runtime dispatch.
- [Static-function work](../../../../../../fjs/js/todo/runtime-static.md) — existing native admission and runtime-table contract.
