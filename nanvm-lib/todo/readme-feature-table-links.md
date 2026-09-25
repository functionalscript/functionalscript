## README feature table cites wrong files

**Priority:** P5
**Status:** open

### Problem

The operator and coercion tables in [`nanvm-lib/README.md`](../README.md) send
a reader to files that do not hold what the row describes:

- **`**`.** The row says "[`numeric.rs`](../src/vm/numeric.rs) implements
  `Number::exponentiate`'s two departures from `f64::powf`". `Numeric::pow` in
  `numeric.rs` only dispatches on the operand types. The two departures — a
  `NaN` exponent, and an infinite exponent against a base of magnitude one —
  are `Number::pow` in [`number/pow.rs`](../src/vm/number/pow.rs), whose doc
  comment names it "the spec's `Number::exponentiate`".
- **To int32 and To uint32.** Both rows link `src/vm/int32_coercion.rs`,
  which does not exist. `to_int32` and `to_uint32` are in
  [`number/int32_coercion.rs`](../src/vm/number/int32_coercion.rs).

### Tasks

- [ ] Point the `**` row's departures at `number/pow.rs`
- [ ] Point both int32 coercion rows at `src/vm/number/int32_coercion.rs`

### Related

- [`nanvm-lib/README.md`](../README.md) — the tables
