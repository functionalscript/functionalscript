## Admit Math.abs

**Priority:** P2
**Status:** wip

### Problem

`Math.abs` is refused, blocking the Rust-number serializer leaf. The
approved target rule uses compatible native operations when both Rust and
core WASM provide them, with no third-party WASM dependencies.

### Proposal

Admit `Math.abs` as a native static function using Rust's `f64::abs` and
core WASM's `f64.abs`. Convert the first argument once with JavaScript
`ToNumber`, retaining bigint rejection and failures. Clear the sign of
numbers, including `-0` and negative infinity; preserve `NaN`. Keep native
callable identity, text and `length` of one. Evaluate extra arguments without
converting them; an omitted argument produces `NaN`.

**Benefits:** familiar JavaScript spelling and exact native absolute value
on both targets without another numerical body or dependency.

**Drawbacks:** each executor needs a binding preserving conversion failures
and special values, particularly `-0` becoming positive zero. This admits
no other `Math` member.

**Language-design approval:** **sergey-shandar** explicitly requested
implementation of `Math.abs` in the
[working session](https://chatgpt.com/c/6af4b740-b0c0-8191-8471-4aa5a50fa03a).

### Tasks

- Add native static admission and execution across JavaScript and Rust.
- Prove numerical, conversion, failure and callable behavior; regenerate outputs.
- Promote accepted leaf modules and record the remaining blockers.
