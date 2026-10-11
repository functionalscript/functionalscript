use core::cmp::Ordering;

use crate::vm::{
    Any, BigInt, IVm, ToAny, Unpacked, ecma_whitespace::is_ecma_whitespace, error,
    numeric::Numeric, primitive::Primitive, primitive_coercion::ToPrimitivePreferredType,
};

impl<A: IVm> Any<A> {
    /// `<`. Throws where `ToPrimitive` does, and where the text of a function
    /// without text would be compared (`error::function_text`).
    pub fn lt(self, rhs: Self) -> Result<Self, Self> {
        Ok(matches!(compare(self, rhs)?, Some(Ordering::Less)).to_any())
    }

    /// `>`.
    pub fn gt(self, rhs: Self) -> Result<Self, Self> {
        Ok(matches!(compare(self, rhs)?, Some(Ordering::Greater)).to_any())
    }

    /// `<=`. Not `!(x > y)`: a `NaN` anywhere gives `false`.
    pub fn le(self, rhs: Self) -> Result<Self, Self> {
        Ok(matches!(compare(self, rhs)?, Some(Ordering::Less | Ordering::Equal)).to_any())
    }

    /// `>=`. Not `!(x < y)`: a `NaN` anywhere gives `false`.
    pub fn ge(self, rhs: Self) -> Result<Self, Self> {
        Ok(matches!(
            compare(self, rhs)?,
            Some(Ordering::Greater | Ordering::Equal)
        )
        .to_any())
    }
}

/// <https://tc39.es/ecma262/#sec-islessthan>, answered as the order of `x`
/// relative to `y`, so `>` and `<=` read it rather than ask `<` of swapped
/// operands. `None` is the spec's `undefined` — comparisons that involve
/// `NaN`, directly or via a string that fails `StringToBigInt` against a
/// `BigInt` — which every operator answers `false`.
///
/// Both operands' `ToPrimitive` run left first, the spec's `LeftFirst` flag.
/// The order is observable, since an object's own `valueOf` or `toString` may
/// throw: `a > b` with both throwing throws `a`'s.
fn compare<A: IVm>(x: Any<A>, y: Any<A>) -> Result<Option<Ordering>, Any<A>> {
    let px = to_primitive_or_text(x)?;
    match (px, to_primitive_or_text(y)?) {
        // A function's text against a string compares the texts.
        (None, None) | (None, Some(Primitive::String(_))) | (Some(Primitive::String(_)), None) => {
            Err(error::function_text())
        }
        // Against anything else, the text is numeric: `NaN` for a number
        // and no `StringToBigInt` for a bigint, so `undefined` either way.
        (None, Some(_)) | (Some(_), None) => Ok(None),
        (Some(px), Some(py)) => compare_primitives(px, py),
    }
}

/// `ToPrimitive(v, number)`, where `None` is the text of a function that has
/// none (`error::function_text`). A function's text is a string that neither
/// `StringToNumber` nor `StringToBigInt` accepts, so `compare` answers a
/// function without text against a number or a bigint, and refuses it only
/// against a string.
fn to_primitive_or_text<A: IVm>(v: Any<A>) -> Result<Option<Primitive<A>>, Any<A>> {
    match v.clone().into() {
        Unpacked::Function(f) => Ok(f.text().map(|t| Primitive::String(t.into()))),
        _ => v
            .to_primitive(Some(ToPrimitivePreferredType::Number))
            .map(Some),
    }
}

fn compare_primitives<A: IVm>(
    px: Primitive<A>,
    py: Primitive<A>,
) -> Result<Option<Ordering>, Any<A>> {
    match (px, py) {
        (Primitive::String(sx), Primitive::String(sy)) => Ok(Some(sx.cmp(&sy))),
        (Primitive::BigInt(bx), Primitive::String(sy)) => {
            let s: std::string::String = sy.into();
            Ok(string_to_bigint(&s)?.map(|by| bx.cmp(&by)))
        }
        (Primitive::String(sx), Primitive::BigInt(by)) => {
            let s: std::string::String = sx.into();
            Ok(string_to_bigint(&s)?.map(|bx| bx.cmp(&by)))
        }
        (px, py) => Ok(primitive_to_numeric(px)?.compare(&primitive_to_numeric(py)?)),
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

/// `StringToBigInt`: a decimal literal (optional leading sign), or a
/// `0x`/`0o`/`0b` literal — those three take no sign, matching the grammar
/// (`NonDecimalIntegerLiteral` has no `Sign` production, unlike
/// `StrIntegerLiteral`'s decimal alternative). Surrounding whitespace is
/// trimmed; `""` (or all whitespace) is `0n`, matching
/// `StringToBigInt("")`. A literal that is not one is `None`; one longer than
/// `BigInt`'s size limit is the `RangeError` the limit throws everywhere.
fn string_to_bigint<A: IVm>(s: &str) -> Result<Option<BigInt<A>>, Any<A>> {
    let trimmed = s.trim_matches(is_ecma_whitespace);
    if trimmed.is_empty() {
        return Ok(Some(BigInt::default()));
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
    Ok(parse_digits(digits, 10)?.map(|m| if negative { -m } else { m }))
}

/// Parses `digits` as an unsigned integer literal in `radix` (2, 8, 10, or
/// 16 — whatever the caller's prefix implied). `None` if `digits` is empty
/// or any byte is out of range for the radix; `char::to_digit` covers both
/// checks (and both cases of hex `a`-`f`) at once. Every digit is checked in a
/// first pass, before any is multiplied in in the second, so a literal that
/// is both invalid and too long is invalid, not a throw, and nothing the
/// size of the input is held besides the input.
fn parse_digits<A: IVm>(digits: &str, radix: u32) -> Result<Option<BigInt<A>>, Any<A>> {
    let digit = |byte: u8| (byte as char).to_digit(radix);
    if digits.is_empty() || !digits.bytes().all(|byte| digit(byte).is_some()) {
        return Ok(None);
    }
    let base: BigInt<A> = (radix as u64).into();
    let mut magnitude = BigInt::default();
    for value in digits.bytes().filter_map(digit) {
        magnitude = magnitude.mul_add(base.clone(), u64::from(value))?;
    }
    Ok(Some(magnitude))
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
    fn nan_is_never_greater() {
        assert!(!bool_of(n(f64::NAN).gt(n(1.0))));
        assert!(!bool_of(n(1.0).gt(n(f64::NAN))));
        assert!(!bool_of(n(f64::NAN).ge(n(1.0))));
        assert!(!bool_of(big(1).ge(n(f64::NAN))));
    }

    #[test]
    fn number_vs_bigint_each_operator() {
        assert!(bool_of(n(5.5).gt(big(5))));
        assert!(!bool_of(n(5.0).gt(big(5))));
        assert!(bool_of(n(5.0).ge(big(5))));
        assert!(!bool_of(n(4.5).ge(big(5))));
        assert!(bool_of(n(4.5).lt(big(5))));
        assert!(bool_of(n(5.0).le(big(5))));
        assert!(bool_of(n(f64::INFINITY).gt(big(5))));
        assert!(bool_of(n(f64::NEG_INFINITY).lt(big(5))));
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
        assert!(bool_of(
            big(1i64 << 60).lt(n((1u64 << 60) as f64 + 2_048.0))
        ));
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
