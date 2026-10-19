## Direct calls and loops in the static runtime

**Priority:** P4
**Status:** open — the optimizations the static runtime left for a
measurement, from its design review; superseded by
[`fjs/js/todo/runtime-value.md`](../../../fjs/js/todo/runtime-value.md),
under which the runtime module prints the direct call only

### Problem

The static runtime (`fjs/compiler/rust/runtime`,
[`fjs/js/runtime/README.md`](../../../fjs/js/runtime/README.md)) prints
every module-level function of `fjs/js/runtime` as a static Rust function,
and a body reaches another through the generic call path, as user code
reaches any function:

- **A known callee is called as a value.** `startsWith` calling its helper
  `found(self, s, start)` prints as `Any::call` of the helper's accessor
  wrapped as a `Function`, through `Function::try_from` and the array of
  arguments, where a direct `found_code::<A>(args)` would skip the
  dispatch. The callee is known at compile time, so the printer could
  print the direct call; it does not yet, since the design principles
  rank simplicity above an optimization no measurement has asked for.
- **A module-level loop function prints as recursion.** A function of the
  shape `r => COND ? self(NEXT) : r` prints, as a closure, as a `loop`
  (`fjs/edag/todo/tail-call-loop.md`); as an item it prints as a body
  that calls its own accessor, a round per stack frame. The runtime has no
  such function today.

### Proposal

Measure first. If a body's helper calls show up, print a `['()', ['frame',
i], args]` whose slot resolves to an item as `item_code::<A>(args)`, the
arguments built as the array they are, and nothing else changes: the item
keeps its accessor for the reads that need a value. The loop printing is
`loopClosure`'s, in `fjs/edag/rust`, and joins the items when a loop
function is written at module level.

### Related

- [`fjs/compiler/rust/runtime/module.f.mjs`](../../../fjs/compiler/rust/runtime/module.f.mjs):
  the printer.
- [`fjs/edag/rust/module.f.mjs`](../../../fjs/edag/rust/module.f.mjs):
  `loopClosure`, the loop printing a closure gets.
