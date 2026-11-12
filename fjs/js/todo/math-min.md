## Admit `Math.min`

**Priority:** P2
**Status:** wip

### Problem

The compiler refuses `Math.min`, blocking `zlib/inflate` after its numeric
table indexes became explicit.

### Proposal

Admit a first-class variadic native static with `length` 2 and native function
text. Convert every argument with `ToNumber` in order, even after NaN or
negative infinity; propagate conversion failures and reject primitive or
converted bigints. Return positive infinity for no arguments, NaN if any
converted argument is NaN, and negative zero over positive zero on a tie.
Preserve positive zero when all greatest-in-magnitude-zero candidates are
positive zeros.

Use Rust's stable `f64::min` with explicit NaN and zero-tie corrections and
core WASM's `f64.min`. Fold from positive infinity without ending conversion
early on NaN. No common numerical body or third-party WASM dependency is
needed. Share the existing variadic binding shape with `Math.max`.

**Benefits:** familiar JavaScript behavior, native operations in both targets,
and progress past the inflater's next compiler refusal.

**Drawbacks:** one more binding and its conversion contract; Rust's native
minimum differs on NaN and signed-zero ties.

**Language-design approval:** **sergey-shandar** explicitly requested
"Implement `Math.min` in the same PR" in
[this session](https://chatgpt.com/c/6af4b740-b0c0-8191-8471-4aa5a50fa03a).

### Tasks

- [ ] Admit the static across the compiler, runtime and represented executors.
- [ ] Add Rust native bindings and scalar/cross-executor boundary tests.
- [ ] Regenerate, validate and promote any accepted modules in #3797.
