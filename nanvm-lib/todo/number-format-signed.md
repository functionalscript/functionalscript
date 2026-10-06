## number-format-signed. Four formatters each peel the sign, format the magnitude and rebuild the string

**Priority:** P5
**Status:** open

### Problem

`Number::to_fixed`, `to_exponential`, `to_precision` and
`to_radix_string` in `vm/number/format.rs` share an opening and a
closing that only the middle tells apart. Each answers a non-finite `x`
with `number_to_string`, then:

```rust
// vm/number/format.rs, all four
let sign = if x < 0.0 { "-" } else { "" };
// to_exponential and to_precision; to_fixed and to_radix_string pass x.abs() to scaled and mantissa_exp2 instead
let x = x.abs();
…
// to_precision; to_fixed and to_radix_string close the same way over `m` and `digits`
Ok(format!("{sign}{text}").as_str().into())
```

The sign line is in all four; all four format the magnitude, with
`to_exponential` and `to_precision` rebinding `x` to `x.abs()` and
`to_fixed` and `to_radix_string` passing `x.abs()` to `scaled` and
`mantissa_exp2` while keeping `x` for the sign; and every one closes by
formatting the sign before its own digits and converting the `&str`. The digit logic between those halves is each
method's own and differs; the halves do not. `BigInt::to_radix_string` in
`vm/bigint/radix.rs` spells the same prefix from `self.sign()`, but its
magnitude is a bigint, not an `f64`, so it is outside what the helper
below takes and stays as it is.

### Proposal

One private helper in `vm/number/format.rs`, for `Number` only, owns
the sign and the `&str` to `String<A>` step:

```rust
/// `-` or nothing, then `magnitude` of `|x|`, as a VM string.
fn signed<A: IVm>(x: f64, magnitude: impl FnOnce(f64) -> std::string::String) -> String<A>
```

Each formatter keeps its digits and its own order of the non-finite and
range checks — `to_fixed` range-checks before it tests finiteness, and
that order stays per method.

### Tasks

- [ ] `signed`; the four `Number` formatters through it.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [binary64-layer](./binary64-layer.md) — `mantissa_exp2` and `pow2`,
  the other helpers `format.rs` reaches for.
- [error-constructors](./error-constructors.md) — `out_of_range`, the
  `RangeError` these formatters throw.
