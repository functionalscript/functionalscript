## Call a known callee directly

**Priority:** P4
**Status:** open — an optimization left for a measurement, retargeted
from the lifting printer's `nanvm/lib/todo/static-runtime-calls.md`, which
went with that printer
([`../../js/runtime/README.md`](../../js/runtime/README.md), "How NaNVM
finds it")

### Problem

The ordinary backend ([`../rust/module.f.mjs`](../rust/module.f.mjs))
prints a module-scope function another body calls — `found` in
[`../../js/runtime`](../../js/runtime/module.f.js), which `startsWith`'s
body calls — as a static function held in a slot, and the body that calls
it captures the slot in its frame and calls it as user code calls any
value, `Any::call(A::frame(self_)[0].clone(), args)`, through
`Function::try_from` and the array of arguments
(`nanvm/lib/src/vm/gen.runtime.rs`). The callee is known when the module
is printed: the slot is filled by one function literal and nothing else.
The printer could print that literal's closure called directly; it does
not yet, since the design principles rank simplicity above an
optimization no measurement has asked for.

A module-level loop function needs nothing here: a function of the shape
`r => COND ? self(NEXT) : r` uses [common tail-loop lowering](../to_fast/README.md#tail-call-eligibility)
wherever it is written, a module's scope included.

### Proposal

Measure first. If a body's calls of a known callee show up, print a
`['()', ['frame', i], args]` whose slot one function literal fills as a
direct call of that literal's closure, the arguments built as the array
they are, and nothing else changes: the slot keeps the value for the
reads that need one.

### Related

- [`../rust/module.f.mjs`](../rust/module.f.mjs): the printer, and
  `loopClosure` in it.
- [`../../js/runtime/README.md`](../../js/runtime/README.md): how a
  compiled module and the runtime value reach each other.
