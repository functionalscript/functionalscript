## Admit `Math.sqrt`, `Math.ceil` and `Math.imul`

**Priority:** P2
**Status:** wip

### Problem

The compiler refuses these three JavaScript statics, blocking
`website/demo/secp`, `zlib/inflate` and `zlib/testlib`.

### Proposal

Admit all three through the existing static-function surface. Use Rust's
`f64::sqrt`, `f64::ceil` and `i32::wrapping_mul`, corresponding to core WASM's
`f64.sqrt`, `f64.ceil` and `i32.mul`. Apply the existing number conversion
before the native operations; `imul` converts both operands to 32-bit integers
in argument order and returns the signed wrapping product. WASM adds no
third-party dependencies. Preserve signed zero, NaN, infinities, missing
arguments, conversion failures, argument evaluation and function metadata.

**Benefits:** familiar JavaScript names, compatible native operations in both
targets, and fewer blocked modules.

**Drawbacks:** three more static names and their conversion and executor
contracts to maintain. A future WASM backend must use the same conversions.

**Language-design approval:** **sergey-shandar** explicitly requested
"Implement `Math.sqrt`, `Math.ceil` and `Math.imul` in a new PR" in
[this session](https://chatgpt.com/c/6af4b740-b0c0-8191-8471-4aa5a50fa03a).
This satisfies DESIGN.md §12's explicit-request approval rule.

### Tasks

- [ ] Admit the statics in the runtime, compiler and represented executors.
- [ ] Add Rust native bindings and cross-executor boundary/conversion proofs.
- [ ] Regenerate artifacts, run scoped checks, and promote accepted modules.
