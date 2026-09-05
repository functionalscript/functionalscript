## string-numeric-literal-scanner. One `StringNumericLiteral` scanner for `StringToNumber` and `StringToBigInt`

**Priority:** P4
**Status:** open

### Problem

The ECMAScript numeric-literal scan is implemented twice:

- `string_to_number` (`src/vm/number_coercion.rs:87-122`), backing
  `StringToNumber`;
- `string_to_bigint` (`src/vm/any/relational.rs:97-126`), backing
  `StringToBigInt` for the relational operators.

Both spell the identical prefix machinery — empty-input-is-zero, the three
`strip_prefix("0x").or_else(|| strip_prefix("0X"))` pairs for hex/octal/
binary, and the `-`/`+` sign-stripping for the decimal alternative — and
both carry the same grammar note ("`NonDecimalIntegerLiteral` has no `Sign`
production") in their doc comments (`number_coercion.rs:79-86`,
`relational.rs:91-96`). Their test suites duplicate the rule case-for-case
too. Only the payloads differ: `f64` accumulation, `Infinity` and the
`StrDecimalLiteral` shape on the number side; `BigInt` digit accumulation on
the bigint side.

Two lesser symptoms of the split ownership:

- The whitespace trim sits on opposite sides of the boundary —
  `NumberCoercion::string` trims at the call site
  (`number_coercion.rs:55`) while `string_to_bigint` trims inside
  (`relational.rs:98`).
- 45 lines of literal lexing live in `any/relational.rs`, the `<` operator's
  file, which is not where anyone would look for `StringToBigInt`.

A grammar change (say, numeric-separator `_` support, or a bug in the
prefix handling) must be found and fixed twice.

### Proposal

A module owning the shared scan — e.g. `src/vm/string_numeric_literal.rs` —
that trims and classifies:

```rust
pub enum StringNumericLiteral<'a> {
    /// Empty or all-whitespace input: the mathematical value 0.
    Zero,
    /// `0x`/`0o`/`0b` literal — no sign, per the grammar.
    NonDecimal { radix: u32, digits: &'a str },
    /// The decimal alternative, sign stripped; `digits` still carries the
    /// number-only forms (`Infinity`, fraction, exponent) for the caller.
    Decimal { negative: bool, rest: &'a str },
}

pub fn scan(s: &str) -> StringNumericLiteral<'_>
```

`string_to_number` keeps only its `f64` payload (`parse_non_decimal`,
`is_str_decimal_literal`, `Infinity`); `string_to_bigint` keeps only
`parse_digits` and moves next to the scanner, out of `relational.rs`. The
shared scanner owns the trim, so the caller-side/callee-side asymmetry
disappears. The duplicated grammar comment survives once, on `scan`.

### Tasks

- [ ] Extract the scanner; port both consumers; move `string_to_bigint` and
      `parse_digits` out of `any/relational.rs`.
- [ ] Deduplicate the shared prefix/sign test cases onto the scanner; keep
      the payload-specific ones (`Infinity`, `StrDecimalLiteral`, digit
      accumulation) where they are.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [numeric-coercion-module](./numeric-coercion-module.md) — the other
  ToNumeric-adjacent logic currently living outside its own module; same
  placement smell, different operation.
