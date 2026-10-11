## binary64-layer. Three modules take an `f64` apart by hand

**Priority:** P3
**Status:** open

### Problem

The bit layout of a binary64 — the 52-bit significand, the 11-bit biased
exponent, the implicit leading bit, the subnormal rule, the bias of 1075
— is decoded in two modules and rebuilt in a third, each with its own
spelling of the same constants:

```rust
// vm/string_coercion.rs, mantissa_exp2
let exponent_bits = (bits >> 52) & 0x7ff;
let mantissa_bits = bits & 0xf_ffff_ffff_ffff;
if exponent_bits == 0 { (mantissa_bits, -1074) }
else { (mantissa_bits | (1u64 << 52), exponent_bits as i32 - 1075) }
// vm/any/relational.rs, whole_f64_to_bigint
let biased_exponent = (bits >> 52) & 0x7FF;
let significand = (bits & 0x000F_FFFF_FFFF_FFFF) | (1u64 << 52);
let exponent = biased_exponent as i64 - 1075;
// vm/number_coercion.rs, parse_non_decimal — the reverse, round to nearest even
let shift = true_bits - 53;
… if mantissa == 1u64 << 53 { /* the carry out of the mantissa */ }
```

The relational copy has no subnormal branch; it `debug_assert!`s the
input is never one. Both decoders also raise two to a power as a
`BigInt` shift, each in its own closure. And the `BigInt → Number`
conversion in [`BigInt::to_number`](../src/vm/bigint/to_f64.rs) rounds
bigint words by converting the top word with a sticky bit and scaling by a
power of two. It is another caller to consider when sharing the rounding
logic with `parse_non_decimal`.

### Proposal

One module owns the layout, `vm/number/binary64.rs` or beside `Number`:

- `Number::decompose(self) -> Option<(Sign, u64, i32)>`: a finite
  value as `±significand · 2^exponent`, subnormals included, `None` for
  NaN and the infinities.
- one compose in the other direction, round-to-nearest-even from a
  significand of any width plus a sticky bit, which `parse_non_decimal`
  and `BigInt::to_number` both call.
- `BigInt::from_integral(Number)` in `bigint/from.rs`, on `decompose`,
  replacing `whole_f64_to_bigint`; and `BigInt::pow2(e)` for the shift
  both decoders write.

`mantissa_exp2`, `whole_f64_to_bigint` and the tail of
`parse_non_decimal` become callers, and the constants are written once.

### Tasks

- [ ] `decompose` and the compose, with tests at the subnormal boundary,
      `2^53`, and the tie cases `number_coercion`'s tests already pin.
- [ ] Rewrite the three sites through them.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [`BigInt::to_number`](../src/vm/bigint/to_f64.rs)
  — bigint conversion is a potential caller of compose.
- [string-numeric-literal-scanner](./string-numeric-literal-scanner.md)
  — the text scan in front of `parse_non_decimal`; independent.
