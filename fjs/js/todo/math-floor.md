## Admit Math.floor

**Priority:** P2
**Status:** wip

### Problem

`Math.floor` is refused, blocking the Rust serializer and Adler-32 leaf
migrations. The approved target rule uses compatible native operations when
both Rust and core WASM provide them, with no third-party WASM dependencies.

### Proposal

Admit `Math.floor` as a native static function. Rust's `f64::floor` and core
WASM's `f64.floor` round toward negative infinity. Convert the first argument
once with JavaScript `ToNumber`, retaining bigint rejection, failures,
signed zero, infinities and `NaN`. Preserve callable identity, native text and
`length` of one; evaluate extra arguments without converting them.

**Benefits:** familiar JavaScript spelling, exact native rounding on both
targets and no common numerical body or dependency.

**Drawbacks:** each executor needs a binding with matching conversion and
special-value behavior. Other `Math` members remain separate admissions.

**Language-design approval:** **sergey-shandar** explicitly requested
implementation of `Math.floor` in the
[working session](https://chatgpt.com/c/6af4b740-b0c0-8191-8471-4aa5a50fa03a).

### Tasks

- Add native static admission and execution across JavaScript and Rust.
- Prove rounding, conversions, failures and callable behavior; regenerate outputs.
- Promote accepted leaf modules and record the remaining blockers.
