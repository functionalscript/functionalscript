## number-to-string-tie-breaking. `number_to_string` breaks exact decimal ties the wrong way

**Priority:** P4
**Status:** open

### Problem

`number_to_string` / `js_digits_to_string` (`src/vm/string_coercion.rs`) build
JS's `Number::toString()` digit sequence from Rust's `{:e}` formatting, which
already computes the shortest decimal that round-trips back to the same
`f64`. That is the right digit sequence for almost every value, but ECMA-262's
algorithm has a tie-break Rust's formatter doesn't implement: when a value's
exact binary fraction sits precisely halfway between two equally-short
round-tripping decimal candidates, the spec picks the one whose last digit is
even (round-half-to-even); Rust's formatter (`ryu`-derived) picks the other
one in this situation.

Three concrete `f64` bit patterns exhibit this, found by differential-fuzzing
against Node over about sixty thousand values:

| bits (hex)         | exact value               | `number_to_string` gives | JS gives      |
|---------------------|---------------------------|---------------------------|---------------|
| `c23a0480a70a2400`   | `-111744689930.140625`    | `-111744689930.14063`     | `-111744689930.14062` |
| `c24e2a807a3c5a00`   | `-259124163704.703125`    | `-259124163704.70313`     | `-259124163704.70312` |
| `c24ed800216b1200`   | `-264945812182.140625`    | `-264945812182.14063`     | `-264945812182.14062` |

In each case the true value's fractional part ends in exactly `...0625` —
precisely halfway between `...062` and `...063` at that many significant
digits — and the preceding digit (`2`) is even, so JS rounds down to `...062`
while today's code rounds up to `...063`.

An earlier attempt at a fix checked "does `digit ± 1` also round-trip to the
same `f64`" as a proxy for "is this an exact tie". That proxy is wrong:
round-trip validity is a *range* condition (any digit sequence within the
value's rounding interval round-trips), not an *exact-equidistance* one, so it
produced false positives — it broke `Number.MAX_VALUE` (`...1.7976931348623157e+308`
became `...158`) and `Number.MIN_VALUE` (`5e-324` became `4e-324`), verified
against Node. Do not repeat that approach; whatever replaces it must decide
the tie exactly, not by a round-trip heuristic.

### Proposal

Deciding the tie correctly needs an exact comparison between the true binary
value and the midpoint of the two candidate decimals — ordinary `f64`
arithmetic can't do this without reintroducing the same rounding error the
check is trying to detect. `nanvm-lib` already carries its own
arbitrary-precision integer type for JS `BigInt` (`src/vm/bigint/`); the most
promising path is reusing it (or the same word-vector machinery) to represent
the `f64`'s exact mantissa/exponent and the candidate decimal scaled to a
common denominator, then compare as integers. That avoids taking on an
external dependency, which would otherwise be a real architectural decision —
`nanvm-lib` is zero-dependency today (see `Cargo.toml`/`Cargo.lock`).

### Tasks

- [ ] Design an exact-arithmetic tie check — reusing `vm/bigint`'s
      arbitrary-precision integer machinery, or an equivalent exact
      representation — that identifies precisely when Rust's `{:e}` shortest
      digits sit halfway between two round-tripping candidates.
- [ ] Apply round-half-to-even only in that exact-tie case; every other value
      keeps today's digits unchanged (Rust's shortest round-trip output is
      already correct whenever there is no tie).
- [ ] Add regression tests for the three bit patterns above, plus
      `f64::MAX`/`f64::MIN_POSITIVE` and `5e-324` (the smallest positive
      denormal) as non-tie guards against the rejected round-trip-proxy
      approach.
- [ ] `cargo test -p nanvm-lib`, `cargo clippy -p nanvm-lib --lib`,
      `cargo fmt -p nanvm-lib -- --check`.

### Related

- `number_to_string` / `js_digits_to_string` in
  [`src/vm/string_coercion.rs`](../src/vm/string_coercion.rs) — the functions
  this issue is about.
- [functionalscript/functionalscript#2068](https://github.com/functionalscript/functionalscript/pull/2068) —
  introduced `js_digits_to_string`'s ECMA-262 notation handling and is where
  this gap was found in review.
