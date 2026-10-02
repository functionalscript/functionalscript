## deep-value-drop. Dropping a deeply nested value overflows the stack

**Priority:** P3
**Status:** wip

### Problem

A value of `nanvm-lib` is reference counted, and dropping the last reference to
a container drops its items, each of which may be a container: the drop is a
recursion as deep as the value. A program can build a deep value at run time
without recursing itself, by folding a long array into a nesting:

```js
const deep = Array.from({ length: 1000000 }, () => 0)
    .reduce(acc => [acc], null)
```

`naive`'s drop of such a value is the compiler's drop glue, one frame per
level, and past a depth the main thread's 8 MiB cannot hold (about a million
levels; a spawned thread's 2 MiB, a quarter of that) it **aborts the process**
with a stack overflow. JavaScript's garbage collector does not recurse, so
this has no JavaScript counterpart; a program that built the value fine dies
when it lets go of it, and `sandbox` cannot capture an abort.

Measured on `main` with a nested array or a nested object, then dropped:

| depth | result |
|---|---|
| 100,000 | ok |
| 1,000,000 | stack overflow, abort |

The reads that recurse over a value are a different problem, because their
answer can be a throw: [array-deep-nesting](./array-deep-nesting.md) has the
measured depths. A drop has no answer to carry, so it has to be iterative.

### Proposal

`naive` drops through a bounded trampoline. A drop that finds itself deeper
than a fixed number of frames does not recurse: it parks the value it was
about to drop on a per-thread list, and the outermost drop, once its own
recursion has returned, empties that list one value at a time, each again at a
bounded depth.

- The hook is `Drop for Naive`, the one type every item of a container is. A
  drop that holds no container, array, object or function, returns at once,
  so a scalar pays nothing.
- The depth is a per-thread counter that needs no destructor, so it is usable
  while a thread's other thread-locals are being torn down; if the parked list
  is already gone, the value is dropped in place, as today.
- The bound is a few hundred frames, measured against the smallest stack a
  test thread has.
- `to_unpacked` moves the unpacked value out of a `Naive` that now implements
  `Drop`, so it swaps it out for `undefined` instead of moving.

It is `naive`'s alone. A VM with another representation owns its own drop;
the contract the `IVm` documentation should state is that dropping a value of
any depth must not abort.

### Tasks

- [ ] Reproduce: tests that build a nested array and a nested object a million
      levels deep and drop them, on a thread with a small stack, which fail
      today.
- [ ] The trampolined `Drop for Naive`, with `to_unpacked` adjusted.
- [ ] A deep value dropped while it is shared: only the last reference
      unwinds, and a value kept alive elsewhere is untouched.
- [ ] A function whose frame holds a deep value.
- [ ] State the drop contract in the `IVm` documentation.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [array-deep-nesting](./array-deep-nesting.md) — the reads that recurse.
- [131-non-panicking-allocator](./131-non-panicking-allocator.md) — the other
  failure that aborts where JavaScript throws.
- [`fjs/edag/todo/stack-safety.md`](../../fjs/edag/todo/stack-safety.md) — the
  same shape one layer up.
