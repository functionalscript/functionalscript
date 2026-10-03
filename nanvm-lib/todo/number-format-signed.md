## number-format-signed. Four formatters each peel the sign, format the magnitude and rebuild the string

**Priority:** P5
**Status:** open

### Problem

`Number::to_fixed`, `to_exponential`, `to_precision` and
`to_radix_string` in `vm/number/format.rs` share an opening and a
closing that only the middle tells apart. Each answers a non-finite `x`
with `number_to_string`, then:

```rust
// vm/number/format.rs, each of the four
let sign = if x < 0.0 { "-" } else { "" };
let x = x.abs();
…
Ok(format!("{sign}{text}").as_str().into())
```

`BigInt::to_radix_string` in `vm/bigint/radix.rs` builds its sign prefix
the same way for its own digits. The digit logic between the two halves
is each method's own and differs; the halves do not.

### Proposal

One private helper owns the sign and the `&str` to `String<A>` step:

```rust
/// `-` or nothing, then `magnitude` of `|x|`, as a VM string.
fn signed<A: IVm>(x: f64, magnitude: impl FnOnce(f64) -> std::string::String) -> String<A>
```

Each formatter keeps its digits and its own order of the non-finite and
range checks — `to_fixed` range-checks before it tests finiteness, and
that order stays per method.

### Tasks

- [ ] `signed`; the four formatters and `BigInt::to_radix_string`'s prefix
      through it.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [binary64-layer](./binary64-layer.md) — `mantissa_exp2` and `pow2`,
  the other helpers `format.rs` reaches for.
- [error-constructors](./error-constructors.md) — `out_of_range`, the
  `RangeError` these formatters throw.
