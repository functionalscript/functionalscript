use crate::{
    sign::Sign,
    vm::{
        Array, BigInt, Function, IVm, Number, Object, String, ToAny,
        any::Any,
        dispatch::Dispatch,
        error,
        nullish::Nullish,
        primitive::Primitive,
        primitive_coercion::ToPrimitivePreferredType,
        string_numeric_literal::{StringNumericLiteral, scan},
    },
};

/// Coerces the value to a `Number`, possibly producing an error result.
/// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion>
/// <https://tc39.es/ecma262/#sec-tonumber>
///
/// It equals to `+self` in JavaScript.
///
/// Note: the function can return an error (JS throw). For example, `+(7n)`.
pub struct NumberCoercion;

fn any_to_number<A: IVm>(a: Any<A>) -> Result<Number, Any<A>> {
    // https://tc39.es/ecma262/#sec-tonumber - starting from point 8:
    // 8. Let primValue be ? ToPrimitive(argument, number).
    // (here we call to_primitive with preferred type Number)
    // 9. Assert: primValue is not an Object.
    // (handled by to_primitive)
    // 10. Return ? ToNumber(primValue).
    // (handled by calls to relevant methods of NumberCoercion)
    match a.to_primitive(Some(ToPrimitivePreferredType::Number))? {
        Primitive::Nullish(n) => NumberCoercion.nullish(n),
        Primitive::Boolean(b) => NumberCoercion.bool(b),
        Primitive::Number(n) => NumberCoercion.number(n),
        Primitive::String(s) => NumberCoercion.string(s),
        Primitive::BigInt(bi) => NumberCoercion.bigint(bi),
    }
}

impl<A: IVm> Dispatch<A> for NumberCoercion {
    type Result = Result<Number, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        Ok(match v {
            Nullish::Null => 0.into(),
            Nullish::Undefined => Number::NAN,
        })
    }

    fn bool(self, v: bool) -> Self::Result {
        Ok(v.into())
    }

    fn number(self, v: Number) -> Self::Result {
        Ok(v)
    }

    fn string(self, v: String<A>) -> Self::Result {
        let s: std::string::String = v.into();
        Ok(string_to_number(&s).into())
    }

    fn bigint(self, _: BigInt<A>) -> Self::Result {
        Err(error::bigint_to_number())
    }

    fn object(self, v: Object<A>) -> Self::Result {
        any_to_number(v.to_any())
    }

    fn array(self, v: Array<A>) -> Self::Result {
        any_to_number(v.to_any())
    }

    fn function(self, _: Function<A>) -> Self::Result {
        // `ToPrimitive` of a function is its text, which is not implemented
        // (`error::function_text`). No text converts to a number — it starts with
        // `(`, `function`, `async` or a name — so the answer is `NaN`
        // without it.
        Ok(Number::NAN)
    }
}

/// `StringToNumber`: the literal [`scan`] finds, read as an `f64`. The
/// non-decimal digits go to [`parse_non_decimal`]; the decimal alternative is
/// `Infinity` or must match `StrDecimalLiteral`'s digits/`.`/exponent shape
/// exactly. Everything else is `NaN`, including the Rust-only spellings
/// (`"inf"`, `"nan"`, ...) `f64::from_str` would otherwise accept.
/// <https://tc39.es/ecma262/#sec-stringtonumber>
fn string_to_number(s: &str) -> f64 {
    match scan(s) {
        StringNumericLiteral::Zero => 0.0,
        StringNumericLiteral::NonDecimal { radix, digits } => parse_non_decimal(digits, radix),
        StringNumericLiteral::Decimal { negative, rest } => {
            let magnitude = if rest == "Infinity" {
                f64::INFINITY
            } else if is_str_decimal_literal(rest) {
                // `rest` is validated and Rust's own float grammar is a
                // superset of it, so this cannot fail.
                rest.parse::<f64>().unwrap_or(f64::NAN)
            } else {
                return f64::NAN;
            };
            if negative { -magnitude } else { magnitude }
        }
    }
}

/// An unsigned integer literal in `radix` (16, 8, or 2 — whatever the
/// caller's prefix implied, all powers of two); `NaN` if `digits` is empty
/// or any character is out of range for the radix.
///
/// The mathematical value is rounded to the nearest `f64` exactly once, at
/// the very end — not, as a naive `fold(0.0, |acc, d| acc * radix + d)`
/// would, once per digit. Folding in `f64` rounds after every digit, and
/// those roundings compound: `0b1111111101110111011101101101011011010110110100010000011`,
/// a 55-bit literal, folds to `35953735677732992.0`, but its correctly
/// rounded value (and JS's) is `35953735677732996.0`.
///
/// Because the radix is a power of two, every digit contributes a fixed
/// number of bits, so the digits are accumulated as one big integer (a
/// `u128` window over the leading bits, plus a `sticky` flag for whether
/// any bit beyond that window is set) and only that integer is rounded, by
/// [`Number::compose`].
fn parse_non_decimal(digits: &str, radix: u32) -> f64 {
    if digits.is_empty() || !digits.chars().all(|c| c.is_digit(radix)) {
        return f64::NAN;
    }
    let bits_per_digit = radix.trailing_zeros();
    let significant = digits.trim_start_matches('0');
    let mut acc: u128 = 0;
    let mut filled_bits = 0u32;
    let mut extra_bits = 0u64;
    let mut sticky = false;
    for c in significant.chars() {
        let d = c.to_digit(radix).unwrap();
        if filled_bits + bits_per_digit <= 128 {
            acc = (acc << bits_per_digit) | d as u128;
            filled_bits += bits_per_digit;
        } else {
            extra_bits += bits_per_digit as u64;
            sticky |= d != 0;
        }
    }
    // `sticky` is set only past a full window, whose leading digit is not
    // zero: `acc` holds over 120 significant bits then, as `compose` asks.
    let exponent = i32::try_from(extra_bits).unwrap_or(i32::MAX);
    Number::compose(Sign::Positive, acc, exponent, sticky)
        .expect("`sticky` is set only past a full window")
        .into()
}

/// `StrUnsignedDecimalLiteral` minus the `Infinity` alternative (handled by
/// the caller): `DecimalDigits`, an optional `. DecimalDigits?`, and an
/// optional `ExponentPart`, in that order, with at least one digit
/// somewhere before any exponent. Deliberately stricter than
/// `f64::from_str`'s own grammar, which additionally accepts `inf`,
/// `infinity`, and `nan` (case-insensitively) — none of which are valid
/// `StringNumericLiteral`s.
fn is_str_decimal_literal(s: &str) -> bool {
    let bytes = s.as_bytes();
    let n = bytes.len();
    let mut i = 0;
    let mut saw_digit = false;
    while i < n && bytes[i].is_ascii_digit() {
        i += 1;
        saw_digit = true;
    }
    if i < n && bytes[i] == b'.' {
        i += 1;
        while i < n && bytes[i].is_ascii_digit() {
            i += 1;
            saw_digit = true;
        }
    }
    if !saw_digit {
        return false;
    }
    if i < n && (bytes[i] == b'e' || bytes[i] == b'E') {
        i += 1;
        if i < n && (bytes[i] == b'+' || bytes[i] == b'-') {
            i += 1;
        }
        let exponent_start = i;
        while i < n && bytes[i].is_ascii_digit() {
            i += 1;
        }
        if i == exponent_start {
            return false;
        }
    }
    i == n
}

#[cfg(test)]
mod test {
    use crate::vm::number_coercion::string_to_number;

    #[test]
    fn empty_and_decimal() {
        assert_eq!(string_to_number(""), 0.0);
        assert_eq!(string_to_number("  "), 0.0);
        assert_eq!(string_to_number(" \u{FEFF}5\n"), 5.0);
        assert_eq!(string_to_number("5"), 5.0);
        assert_eq!(string_to_number("5."), 5.0);
        assert_eq!(string_to_number(".5"), 0.5);
        assert_eq!(string_to_number("-5.5e2"), -550.0);
        assert_eq!(string_to_number("+5"), 5.0);
        assert!(string_to_number("-0").is_sign_negative());
    }

    #[test]
    fn non_decimal_literals() {
        assert_eq!(string_to_number("0x10"), 16.0);
        assert_eq!(string_to_number("0X1A"), 26.0);
        assert_eq!(string_to_number("0o10"), 8.0);
        assert_eq!(string_to_number("0b10"), 2.0);
    }

    #[test]
    fn non_decimal_rounds_once() {
        // A 55-bit literal beyond `f64`'s 53-bit mantissa: rounding after
        // every digit (`acc * radix + digit` folded in `f64`) gives
        // 35953735677732992, but the correctly-rounded value — rounding
        // the exact mathematical value exactly once — is 35953735677732996,
        // matching real JS's `Number("0b111...011")`.
        assert_eq!(
            string_to_number("0b1111111101110111011101101101011011010110110100010000011"),
            35_953_735_677_732_996.0
        );
        // Exactness at and around the 53-bit boundary, and well beyond it.
        assert_eq!(
            string_to_number("0xFFFFFFFFFFFFF"),
            0xF_FFFF_FFFF_FFFFu64 as f64
        );
        assert_eq!(
            string_to_number("0x10000000000000"),
            0x10_0000_0000_0000u64 as f64
        );
        // Ties to even: `2^53 + 1` sits exactly halfway between the two
        // representable neighbors `2^53` and `2^53 + 2`; the lower one has
        // an even mantissa (`2^52`), so the tie rounds down.
        assert_eq!(
            string_to_number(&format!("0b1{}1", "0".repeat(52))),
            9_007_199_254_740_992.0 // 2^53
        );
        // `2^53 + 3` is also a tie (between `2^53 + 2` and `2^53 + 4`), but
        // the lower neighbor's mantissa (`2^52 + 1`) is now odd, so this
        // one rounds up instead.
        assert_eq!(
            string_to_number(&format!("0b1{}11", "0".repeat(51))),
            9_007_199_254_740_996.0 // 2^53 + 4
        );
        // All trailing zero digits past a 128-bit window: still exact
        // (`sticky` stays `false`), not merely "close".
        assert_eq!(
            string_to_number(&format!("0x1{}", "0".repeat(40))),
            (16f64).powi(40)
        );
        // `2^53 + 1` followed by forty zero digits is a tie, as above; a
        // set digit past the 128-bit window breaks it upward.
        let tie = format!("0x20000000000001{}", "0".repeat(40));
        assert_eq!(
            string_to_number(&tie),
            9_007_199_254_740_992.0 * (16f64).powi(40)
        );
        assert_eq!(
            string_to_number(&format!("{tie}1")),
            9_007_199_254_740_994.0 * (16f64).powi(41)
        );
        // `2^1024` is past the largest finite value.
        assert_eq!(
            string_to_number(&format!("0x1{}", "0".repeat(256))),
            f64::INFINITY
        );
    }

    #[test]
    fn infinity() {
        assert_eq!(string_to_number("Infinity"), f64::INFINITY);
        assert_eq!(string_to_number("-Infinity"), f64::NEG_INFINITY);
        assert_eq!(string_to_number("+Infinity"), f64::INFINITY);
    }

    #[test]
    fn rejects_rust_only_spellings() {
        // Rust's own `f64::from_str` accepts these; ECMA-262
        // `StringNumericLiteral` does not.
        for s in [
            "inf", "infinity", "INFINITY", "nan", "NaN", "1x", "0x10x", ".",
        ] {
            assert!(string_to_number(s).is_nan(), "{s}");
        }
    }

    #[test]
    fn rejects_non_literals() {
        // A sign on a non-decimal literal, a lone sign, an empty digit run,
        // and syntax only source code has.
        for s in [
            "-0x10",
            "+0x10",
            "-",
            "+",
            "0x",
            "0b2",
            "0o8",
            "1n",
            "1_0",
            "\u{0085}1",
        ] {
            assert!(string_to_number(s).is_nan(), "{s}");
        }
    }
}
