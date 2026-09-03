use core::cmp::Ordering;

use crate::vm::{
    Any, BigInt, IVm, ToAny, Unpacked, ecma_whitespace::is_ecma_whitespace, numeric::Numeric,
    primitive::Primitive, primitive_coercion::ToPrimitivePreferredType,
};

impl<A: IVm> Any<A> {
    /// `<`. Never throws in practice — the only fallible step is
    /// `ToPrimitive`, which this VM's primitive-shaped values never fail —
    /// but stays a `Result` to match every other binary operator's shape.
    pub fn lt(self, rhs: Self) -> Result<Self, Self> {
        Ok(is_less_than(self, rhs)?.unwrap_or(false).to_any())
    }

    /// `>`. `x > y` is the reversed `<`: `y < x`.
    pub fn gt(self, rhs: Self) -> Result<Self, Self> {
        Ok(is_less_than(rhs, self)?.unwrap_or(false).to_any())
    }

    /// `<=`. `x <= y` is `!(y < x)`, except a `NaN` anywhere still gives
    /// `false`, not the `true` a plain negation of an undefined `<` would.
    pub fn le(self, rhs: Self) -> Result<Self, Self> {
        Ok((!is_less_than(rhs, self)?.unwrap_or(true)).to_any())
    }

    /// `>=`. `x >= y` is `!(x < y)`, with the same `NaN` care as `<=`.
    pub fn ge(self, rhs: Self) -> Result<Self, Self> {
        Ok((!is_less_than(self, rhs)?.unwrap_or(true)).to_any())
    }
}

/// <https://tc39.es/ecma262/#sec-islessthan>
///
/// `None` is the spec's `undefined` result — comparisons that involve `NaN`,
/// directly or via a string that fails `StringToBigInt` against a `BigInt`.
/// Every caller above folds it to `false`, but which side of `<` is queried
/// determines whether that `false` becomes `<`'s own result or the negation
/// `<=`/`>=` build from it, so it's kept distinct from a "real" `false` up to
/// that point.
fn is_less_than<A: IVm>(x: Any<A>, y: Any<A>) -> Result<Option<bool>, Any<A>> {
    let px = x.to_primitive(Some(ToPrimitivePreferredType::Number))?;
    let py = y.to_primitive(Some(ToPrimitivePreferredType::Number))?;

    match (px, py) {
        (Primitive::String(sx), Primitive::String(sy)) => Ok(Some(sx < sy)),
        (Primitive::BigInt(bx), Primitive::String(sy)) => {
            let s: std::string::String = sy.into();
            Ok(string_to_bigint(&s).map(|by| bx < by))
        }
        (Primitive::String(sx), Primitive::BigInt(by)) => {
            let s: std::string::String = sx.into();
            Ok(string_to_bigint(&s).map(|bx| bx < by))
        }
        (px, py) => {
            let nx = primitive_to_numeric(px)?;
            let ny = primitive_to_numeric(py)?;
            Ok(numeric_less_than(nx, ny))
        }
    }
}

/// The non-`BigInt` half of `Any::to_numeric` — `px`/`py` are already
/// primitives here, so this skips the `ToPrimitive` call `to_numeric` would
/// otherwise repeat.
fn primitive_to_numeric<A: IVm>(p: Primitive<A>) -> Result<Numeric<A>, Any<A>> {
    match p {
        Primitive::BigInt(bi) => Ok(Numeric::BigInt(bi)),
        other => {
            let any: Any<A> = Unpacked::from(other).into();
            Ok(Numeric::Number(any.to_number()?))
        }
    }
}

fn numeric_less_than<A: IVm>(nx: Numeric<A>, ny: Numeric<A>) -> Option<bool> {
    match (nx, ny) {
        (Numeric::Number(a), Numeric::Number(b)) => {
            if a.is_nan() || b.is_nan() {
                None
            } else {
                Some(a < b)
            }
        }
        (Numeric::BigInt(a), Numeric::BigInt(b)) => Some(a < b),
        (Numeric::Number(a), Numeric::BigInt(b)) => number_lt_bigint(a, &b),
        (Numeric::BigInt(a), Numeric::Number(b)) => bigint_lt_number(&a, b),
    }
}

/// `StringToBigInt`: a decimal literal (optional leading sign), or a
/// `0x`/`0o`/`0b` literal — those three take no sign, matching the grammar
/// (`NonDecimalIntegerLiteral` has no `Sign` production, unlike
/// `StrIntegerLiteral`'s decimal alternative). Surrounding whitespace is
/// trimmed; `""` (or all whitespace) is `0n`, matching
/// `StringToBigInt("")`.
fn string_to_bigint<A: IVm>(s: &str) -> Option<BigInt<A>> {
    let trimmed = s.trim_matches(is_ecma_whitespace);
    if trimmed.is_empty() {
        return Some(BigInt::default());
    }
    if let Some(digits) = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
    {
        return parse_digits(digits, 16);
    }
    if let Some(digits) = trimmed
        .strip_prefix("0o")
        .or_else(|| trimmed.strip_prefix("0O"))
    {
        return parse_digits(digits, 8);
    }
    if let Some(digits) = trimmed
        .strip_prefix("0b")
        .or_else(|| trimmed.strip_prefix("0B"))
    {
        return parse_digits(digits, 2);
    }
    let (negative, digits) = match trimmed.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, trimmed.strip_prefix('+').unwrap_or(trimmed)),
    };
    let magnitude = parse_digits(digits, 10)?;
    Some(if negative { -magnitude } else { magnitude })
}

/// Parses `digits` as an unsigned integer literal in `radix` (2, 8, 10, or
/// 16 — whatever the caller's prefix implied). `None` if `digits` is empty
/// or any byte is out of range for the radix; `char::to_digit` covers both
/// checks (and both cases of hex `a`-`f`) at once.
fn parse_digits<A: IVm>(digits: &str, radix: u32) -> Option<BigInt<A>> {
    if digits.is_empty() {
        return None;
    }
    let base: BigInt<A> = (radix as u64).into();
    let mut magnitude = BigInt::default();
    for byte in digits.bytes() {
        let digit = (byte as char).to_digit(radix)?;
        magnitude = magnitude * base.clone() + BigInt::from(digit as u64);
    }
    Some(magnitude)
}

/// `Number < BigInt`, per steps (g)-(k): `NaN` and the infinities are
/// decided by the `Number` side alone; everything else needs the exact
/// mathematical comparison `compare_bigint_number` gives.
fn number_lt_bigint<A: IVm>(a: f64, b: &BigInt<A>) -> Option<bool> {
    if a.is_nan() {
        return None;
    }
    if a.is_infinite() {
        return Some(a.is_sign_negative());
    }
    Some(compare_bigint_number(b, a) == Ordering::Greater)
}

/// `BigInt < Number`, the mirror of [`number_lt_bigint`].
fn bigint_lt_number<A: IVm>(a: &BigInt<A>, b: f64) -> Option<bool> {
    if b.is_nan() {
        return None;
    }
    if b.is_infinite() {
        return Some(b.is_sign_positive());
    }
    Some(compare_bigint_number(a, b) == Ordering::Less)
}

/// Ordering of `bi` relative to the finite, non-`NaN` `f` — the exact
/// mathematical comparison ECMA-262 step (k) asks for, not
/// `bi.to_f64() < f`, which would round `bi` and could be wrong for a
/// magnitude a `f64` mantissa can't hold exactly. `bi`'s ordering against
/// `f.floor()` (itself exact, via [`whole_f64_to_bigint`]) settles it,
/// except when they're equal: `f` is still strictly greater whenever it has
/// a fractional part.
fn compare_bigint_number<A: IVm>(bi: &BigInt<A>, f: f64) -> Ordering {
    let floor = f.floor();
    let floor_bi = whole_f64_to_bigint::<A>(floor);
    match bi.cmp(&floor_bi) {
        Ordering::Equal if f != floor => Ordering::Less,
        order => order,
    }
}

/// The exact `BigInt` value of a finite, whole-number `f64`, built from its
/// IEEE 754 bit pattern rather than any decimal round-trip — a `f64` beyond
/// 2^53 is still an exact integer, just one with known trailing zero bits,
/// and this reads those bits directly instead of trusting that a `Display`
/// implementation preserves them.
fn whole_f64_to_bigint<A: IVm>(f: f64) -> BigInt<A> {
    if f == 0.0 {
        return BigInt::default();
    }
    let bits = f.to_bits();
    let biased_exponent = (bits >> 52) & 0x7FF;
    debug_assert!(
        biased_exponent != 0,
        "a nonzero whole f64 is never subnormal"
    );
    let significand = (bits & 0x000F_FFFF_FFFF_FFFF) | (1u64 << 52);
    // The value is `significand * 2^(biased_exponent - 1075)`: 1075 is the
    // usual double bias (1023) plus 52, since `significand` already carries
    // the mantissa's 52 fractional bits as whole-number bits of its own.
    let exponent = biased_exponent as i64 - 1075;
    let magnitude: BigInt<A> = significand.into();
    let magnitude = if exponent >= 0 {
        (magnitude << BigInt::from(exponent as u64))
            .expect("a finite f64's exponent cannot overflow BigInt::shl's word-count limit")
    } else {
        // The shift amount here is always non-negative (`-exponent` where
        // `exponent < 0`), so `BigInt::shr` never takes its
        // negative-shift-amount path into `<<` — the one path that can
        // return `Err` — and this can't fail.
        (magnitude >> BigInt::from((-exponent) as u64))
            .expect("a non-negative BigInt::shr shift amount cannot fail")
    };
    if f.is_sign_negative() {
        -magnitude
    } else {
        magnitude
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, ToAny},
    };

    type A = Naive;

    fn n(v: f64) -> Any<A> {
        v.to_any()
    }

    fn big(v: i64) -> Any<A> {
        Into::<BigInt<A>>::into(v).to_any()
    }

    fn bool_of(r: Result<Any<A>, Any<A>>) -> bool {
        bool::try_from(r.unwrap()).unwrap()
    }

    #[test]
    fn number_lt_number() {
        assert!(bool_of(n(1.0).lt(n(2.0))));
        assert!(!bool_of(n(2.0).lt(n(1.0))));
    }

    #[test]
    fn nan_is_never_less() {
        assert!(!bool_of(n(f64::NAN).lt(n(1.0))));
        assert!(!bool_of(n(1.0).lt(n(f64::NAN))));
        assert!(!bool_of(n(f64::NAN).le(n(1.0))));
        assert!(!bool_of(n(1.0).le(n(f64::NAN))));
    }

    #[test]
    fn string_lexicographic() {
        let s = |v: &str| -> Any<A> { v.into() };
        assert!(bool_of(s("10").lt(s("9"))));
        assert!(!bool_of(s("9").lt(s("10"))));
    }

    #[test]
    fn bigint_vs_number_exact() {
        assert!(bool_of(big(5).lt(n(5.5))));
        assert!(!bool_of(big(5).lt(n(5.0))));
        assert!(bool_of(big(5).le(n(5.0))));
        assert!(bool_of(big(5).lt(n(f64::INFINITY))));
        assert!(!bool_of(big(5).lt(n(f64::NEG_INFINITY))));
    }

    #[test]
    fn large_bigint_vs_large_number_exact() {
        // 2^60 vs 2^60 + 2048 as a whole f64 (both exactly representable):
        // rounding the `BigInt` down to `f64` first would be wrong here,
        // since a naive `bi.to_f64() < f` could compare equal instead.
        assert!(bool_of(big(1i64 << 60).lt(n((1u64 << 60) as f64 + 2048.0))));
    }

    #[test]
    fn string_to_bigint_comparison() {
        let s = |v: &str| -> Any<A> { v.into() };
        assert!(bool_of(s("10").lt(big(20))));
        assert!(bool_of(big(20).lt(s("30"))));
        assert!(!bool_of(s("abc").lt(big(20))));
        assert!(!bool_of(big(20).lt(s("abc"))));
    }

    #[test]
    fn string_to_bigint_non_decimal_literals() {
        let s = |v: &str| -> Any<A> { v.into() };
        // "0x10" is 16n, "0o10" is 8n, "0b10" is 2n — StringToBigInt parses
        // all three, not just decimal, so each compares as its value rather
        // than falling through to "not a valid literal".
        assert!(bool_of(s("0x10").lt(big(17))));
        assert!(!bool_of(s("0x10").lt(big(16))));
        assert!(bool_of(s("0o10").lt(big(9))));
        assert!(bool_of(s("0b10").lt(big(3))));
        assert!(bool_of(s("0X1A").lt(big(27))));
        // The sign-less forms don't accept a sign; "-0x10" is not a valid
        // literal at all, so the comparison is `false` in both directions.
        assert!(!bool_of(s("-0x10").lt(big(100))));
        assert!(!bool_of(big(-100).lt(s("-0x10"))));
        // An empty digit run after the prefix is invalid too.
        assert!(!bool_of(s("0x").lt(big(1))));
    }

    #[test]
    fn string_to_bigint_ecma_whitespace() {
        let s = |v: &str| -> Any<A> { v.into() };
        // U+FEFF (BOM) is ECMA-262 `WhiteSpace` and gets trimmed; U+0085
        // (NEL) is not, even though Rust's `str::trim()` disagrees both
        // ways (it misses the former and trims the latter).
        assert!(bool_of(s("\u{FEFF}1").lt(big(2))));
        assert!(!bool_of(s("\u{0085}1").lt(big(2))));
        assert!(!bool_of(big(0).lt(s("\u{0085}1"))));
    }
}
