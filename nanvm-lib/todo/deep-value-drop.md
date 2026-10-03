## Stack-safe destruction in another VM

**Priority:** P4
**Status:** on-hold

### Problem

`naive` releases containers through ordinary Rust reference counting. Dropping
the last reference to a container releases its children recursively, so a
value built iteratively can still overflow the stack when it is destroyed.
The process aborts; this cannot be converted into a language-level throw by
`sandbox`.

The following Rust program builds nested arrays on a small stack and drops
them. To reproduce locally, place it in
`nanvm-lib/examples/deep-value-drop.rs` and run
`cargo run -p nanvm-lib --example deep-value-drop` from the repository root.
Run it in a separate process: it is a crash reproducer, not a passing test
for `naive`.

```rust
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Nullish, ToAny, ToArray},
};

fn main() {
    std::thread::Builder::new()
        .stack_size(256 * 1024)
        .spawn(|| {
            let value: Any<Naive> = (0..100_000)
                .fold(Nullish::Null.to_any(), |a, _| [a].to_array().to_any());
            drop(value);
        })
        .unwrap()
        .join()
        .unwrap();
}
```

The chosen depth is a stress input, not a portable failure threshold. The
available stack, build profile, and platform affect where destruction fails.

### Proposal

Defer implementation until after the MVP. Preserve
[`naive`'s educational reference role](../src/naive/README.md) and investigate
stack-safe destruction in another VM implementation alongside it.

The new implementation supplies its own core representation and internal
traits through `IVm`, reusing the existing generic operations, utilities, and
test corpus. Document its resource guarantees on that implementation; do not
add an arbitrary-depth destruction guarantee to every `IVm` implementation.

Choose the reclamation design separately. An explicit work list, bounded
recursion, or a different ownership model may be considered; this TODO does
not select the thread-local trampoline prototyped in PR #2520.

### Tasks

- [ ] Describe the new VM's core, ownership model, and destruction guarantees,
      including behavior during thread teardown and allocation failure.
- [ ] Implement that core while keeping `naive` simple and reusing the shared
      infrastructure.
- [ ] Validate language behavior with the existing test corpus and add
      backend-specific destruction tests for nested arrays, objects, captured
      function frames, shared references, and multiple deep children.
- [ ] Check the guarantees on the backend's supported targets and compare
      ordinary-value costs with `naive`.

### Related

- [PR #2520](https://github.com/functionalscript/functionalscript/pull/2520) —
  the initial investigation and the decision to preserve `naive`.
- [array-deep-nesting](./array-deep-nesting.md) — recursive shared operations;
  stack-safe destruction does not make these walks stack-safe.
- [131-non-panicking-allocator](./131-non-panicking-allocator.md) — allocation
  failure handling.
- [stack-safety](../../fjs/edag/todo/stack-safety.md) — stack use in EDAG
  processing.
