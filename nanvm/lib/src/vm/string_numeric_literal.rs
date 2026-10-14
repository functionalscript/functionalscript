use crate::vm::{Any, BigInt, IVm, ecma_whitespace::is_ecma_whitespace};

/// The shape of a `StringNumericLiteral` — the part of the grammar
/// `StringToNumber` and `StringToBigInt` share — before either reads its
/// payload. <https://tc39.es/ecma262/#sec-tonumber-applied-to-the-string-type>
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum StringNumericLiteral<'a> {
    /// Empty or all-whitespace input: the mathematical value 0.
    Zero,
    /// A `0x`/`0o`/`0b` literal (either case) — no sign, per the grammar.
    /// `digits` is unchecked and may be empty.
    NonDecimal { radix: u32, digits: &'a str },
    /// The decimal alternative, one leading `-` or `+` stripped; `rest` still
    /// carries the number-only forms (`Infinity`, fraction, exponent) for the
    /// caller, and is unchecked.
    Decimal { negative: bool, rest: &'a str },
}

/// Trims ECMA-262 `WhiteSpace` and `LineTerminator` (`is_ecma_whitespace`)
/// from both ends of `s` and classifies what is left. `0x`/`0o`/`0b` are the
/// non-decimal integer literals, which take no sign:
/// `NonDecimalIntegerLiteral` has no `Sign` production, unlike the decimal
/// alternative (`StrDecimalLiteral`, `StrIntegerLiteral`). So `-0x10` is the
/// decimal alternative with `rest` `0x10`, which no caller accepts.
pub(crate) fn scan(s: &str) -> StringNumericLiteral<'_> {
    let trimmed = s.trim_matches(is_ecma_whitespace);
    if trimmed.is_empty() {
        return StringNumericLiteral::Zero;
    }
    for (radix, lower, upper) in [(16, "0x", "0X"), (8, "0o", "0O"), (2, "0b", "0B")] {
        if let Some(digits) = trimmed
            .strip_prefix(lower)
            .or_else(|| trimmed.strip_prefix(upper))
        {
            return StringNumericLiteral::NonDecimal { radix, digits };
        }
    }
    let (negative, rest) = match trimmed.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, trimmed.strip_prefix('+').unwrap_or(trimmed)),
    };
    StringNumericLiteral::Decimal { negative, rest }
}

/// `StringToBigInt`: the literal [`scan`] finds, whose digits must all be in
/// range — decimal ones only for the decimal alternative. A literal that is
/// not one is `None`; one longer than `BigInt`'s size limit is the
/// `RangeError` the limit throws everywhere.
/// <https://tc39.es/ecma262/#sec-stringtobigint>
pub(crate) fn string_to_bigint<A: IVm>(s: &str) -> Result<Option<BigInt<A>>, Any<A>> {
    match scan(s) {
        StringNumericLiteral::Zero => Ok(Some(BigInt::default())),
        StringNumericLiteral::NonDecimal { radix, digits } => parse_digits(digits, radix),
        StringNumericLiteral::Decimal { negative, rest } => {
            Ok(parse_digits(rest, 10)?.map(|m| if negative { -m } else { m }))
        }
    }
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
    use super::{
        StringNumericLiteral::{self, Decimal, NonDecimal, Zero},
        scan, string_to_bigint,
    };
    use crate::{naive::Naive, vm::BigInt};

    fn non_decimal(radix: u32, digits: &str) -> StringNumericLiteral<'_> {
        NonDecimal { radix, digits }
    }

    fn decimal(negative: bool, rest: &str) -> StringNumericLiteral<'_> {
        Decimal { negative, rest }
    }

    fn bigint(s: &str) -> Option<BigInt<Naive>> {
        string_to_bigint(s).unwrap()
    }

    fn int(v: i64) -> Option<BigInt<Naive>> {
        Some(v.into())
    }

    #[test]
    fn empty_is_zero() {
        assert_eq!(scan(""), Zero);
        assert_eq!(scan("  "), Zero);
        assert_eq!(scan("\t\n\u{FEFF}"), Zero);
    }

    #[test]
    fn non_decimal_prefixes() {
        assert_eq!(scan("0x10"), non_decimal(16, "10"));
        assert_eq!(scan("0X1A"), non_decimal(16, "1A"));
        assert_eq!(scan("0o10"), non_decimal(8, "10"));
        assert_eq!(scan("0O10"), non_decimal(8, "10"));
        assert_eq!(scan("0b10"), non_decimal(2, "10"));
        assert_eq!(scan("0B10"), non_decimal(2, "10"));
        // The digits are the caller's to check: an empty run or a stray
        // character is still this alternative.
        assert_eq!(scan("0x"), non_decimal(16, ""));
        assert_eq!(scan("0x10x"), non_decimal(16, "10x"));
    }

    #[test]
    fn sign_only_on_decimal() {
        assert_eq!(scan("5"), decimal(false, "5"));
        assert_eq!(scan("+5"), decimal(false, "5"));
        assert_eq!(scan("-5.5e2"), decimal(true, "5.5e2"));
        assert_eq!(scan("-Infinity"), decimal(true, "Infinity"));
        // No `Sign` production for the non-decimal forms: a signed one is
        // the decimal alternative, which then fails on its `x`.
        assert_eq!(scan("-0x10"), decimal(true, "0x10"));
        assert_eq!(scan("+0x10"), decimal(false, "0x10"));
        // A lone sign is not empty input; one sign only.
        assert_eq!(scan("-"), decimal(true, ""));
        assert_eq!(scan("+"), decimal(false, ""));
        assert_eq!(scan("+-5"), decimal(false, "-5"));
        assert_eq!(scan("--5"), decimal(true, "-5"));
        // Not literal syntax here, but no prefix either.
        assert_eq!(scan("1n"), decimal(false, "1n"));
        assert_eq!(scan("1_0"), decimal(false, "1_0"));
    }

    #[test]
    fn trims_ecma_whitespace_not_nel() {
        // U+FEFF (BOM) is ECMA-262 `WhiteSpace` and gets trimmed; U+0085
        // (NEL) is not, even though Rust's `str::trim()` disagrees both
        // ways (it misses the former and trims the latter).
        assert_eq!(scan("\u{FEFF}1"), decimal(false, "1"));
        assert_eq!(scan(" \u{2028}-0x10\u{3000}"), decimal(true, "0x10"));
        assert_eq!(scan("\u{0085}1"), decimal(false, "\u{0085}1"));
    }

    #[test]
    fn bigint_literals() {
        // "0x10" is 16n, "0o10" is 8n, "0b10" is 2n — StringToBigInt parses
        // all three, not just decimal.
        assert_eq!(bigint("0x10"), int(16));
        assert_eq!(bigint("0X1A"), int(26));
        assert_eq!(bigint("0o10"), int(8));
        assert_eq!(bigint("0b10"), int(2));
        assert_eq!(bigint("10"), int(10));
        assert_eq!(bigint("+10"), int(10));
        assert_eq!(bigint("-10"), int(-10));
        assert_eq!(bigint("-0"), int(0));
        assert_eq!(bigint(" \u{FEFF}7\n"), int(7));
        // Wider than one `u64` word.
        assert_eq!(
            bigint("0x10000000000000000"),
            Some((BigInt::from(1u64) << BigInt::from(64u64)).unwrap())
        );
    }

    #[test]
    fn bigint_edge_inputs() {
        assert_eq!(bigint(""), int(0));
        assert_eq!(bigint("  "), int(0));
        for s in [
            "-0x10",
            "+0x10",
            "-",
            "+",
            "0x",
            "0b2",
            "0o8",
            "Infinity",
            "-Infinity",
            "1n",
            "1_0",
            "1.0",
            "1e3",
            "abc",
            "\u{0085}1",
        ] {
            assert_eq!(bigint(s), None, "{s}");
        }
    }
}
