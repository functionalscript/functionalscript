## Admit `Math.max`

**Priority:** P2
**Status:** wip

### Problem

The compiler refuses `Math.max`, blocking `website/demo/secp` after the
square-root admission.

### Proposal

Admit a first-class variadic native static, with `length` 2 and native function
text. Convert every argument with `ToNumber` in order, including arguments
after NaN or positive infinity; propagate conversion failures and reject
primitive or converted bigints. Return negative infinity for no arguments,
NaN if any converted argument is NaN, and positive zero over negative zero
when both occur. Preserve negative zero when it is the greatest value alone.

Use Rust's stable `f64::max` with explicit NaN and zero-tie corrections and
core WASM's `f64.max`. Fold from negative infinity without ending conversion
early on NaN. Rust's `f64::maximum` is unstable on the pinned toolchain.
No common numerical body or third-party WASM dependency is needed.

**Benefits:** familiar JavaScript behavior and compatible native operations
in both targets, unblocking the secp demo's next compiler refusal.

**Drawbacks:** one more static binding; the variadic conversion order and
Rust's NaN and zero differences require explicit tests.

**Language-design approval:** **sergey-shandar** explicitly requested
"Implement `Math.max` and replace `Array.from` by generator in the same PR" in
[this session](https://chatgpt.com/c/6af4b740-b0c0-8191-8471-4aa5a50fa03a).

### Tasks

- [ ] Admit the static in the compiler, runtime and represented executors.
- [ ] Add Rust bindings, scalar tests and cross-executor fixtures.
- [ ] Regenerate, validate and promote any accepted modules in #3797.
