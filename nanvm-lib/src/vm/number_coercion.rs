use core::f64;

use crate::vm::{
    Array, BigInt, Function, IVm, Object, String, ToAny, any::Any, dispatch::Dispatch,
    ecma_whitespace::is_ecma_whitespace, nullish::Nullish, primitive::Primitive,
    primitive_coercion::ToPrimitivePreferredType,
};

/// Coerces the value to f64, possibly producing an error result.
/// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion>
/// <https://tc39.es/ecma262/#sec-tonumber>
///
/// It equals to `+self` in JavaScript.
///
/// Note: the function can return an error (JS throw). For example, `+(7n)`.
pub struct NumberCoercion;

fn any_to_number<A: IVm>(a: Any<A>) -> Result<f64, Any<A>> {
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
    type Result = Result<f64, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        Ok(match v {
            Nullish::Null => 0.0,
            Nullish::Undefined => f64::NAN,
        })
    }

    fn bool(self, v: bool) -> Self::Result {
        Ok(to_f64(v))
    }

    fn number(self, v: f64) -> Self::Result {
        Ok(v)
    }

    fn string(self, v: String<A>) -> Self::Result {
        let s: std::string::String = v.into();
        Ok(string_to_number(s.trim_matches(is_ecma_whitespace)))
    }

    fn bigint(self, _: BigInt<A>) -> Self::Result {
        Err("TypeError: Cannot convert a BigInt value to a number".into())
    }

    fn object(self, v: Object<A>) -> Self::Result {
        any_to_number(v.to_any())
    }

    fn array(self, v: Array<A>) -> Self::Result {
        any_to_number(v.to_any())
    }

    fn function(self, v: Function<A>) -> Self::Result {
        any_to_number(v.to_any())
    }
}

fn to_f64(v: bool) -> f64 {
    v as u8 as f64
}

/// `StringToNumber` on an already-trimmed string: `""` is `0`, `0x`/`0o`/`0b`
/// are the unsigned non-decimal integer literals (same restriction
/// `StringToBigInt` has — no `Sign` production), `Infinity` (with an
/// optional leading sign) is an infinity, and anything else must match
/// `StrDecimalLiteral`'s digits/`.`/exponent shape exactly. Everything else
/// is `NaN`, including the Rust-only spellings (`"inf"`, `"nan"`, ...)
/// `f64::from_str` would otherwise accept.
/// <https://tc39.es/ecma262/#sec-stringtonumber>
fn string_to_number(trimmed: &str) -> f64 {
    if trimmed.is_empty() {
        return 0.0;
    }
    if let Some(digits) = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
    {
        return parse_non_decimal(digits, 16);
    }
    if let Some(digits) = trimmed
        .strip_prefix("0o")
        .or_else(|| trimmed.strip_prefix("0O"))
    {
        return parse_non_decimal(digits, 8);
    }
    if let Some(digits) = trimmed
        .strip_prefix("0b")
        .or_else(|| trimmed.strip_prefix("0B"))
    {
        return parse_non_decimal(digits, 2);
    }
    let (sign, rest) = match trimmed.strip_prefix('-') {
        Some(rest) => (-1.0, rest),
        None => (1.0, trimmed.strip_prefix('+').unwrap_or(trimmed)),
    };
    if rest == "Infinity" {
        return sign * f64::INFINITY;
    }
    if !is_str_decimal_literal(rest) {
        return f64::NAN;
    }
    // `rest` is validated, and `trimmed` is `rest` with the same optional
    // leading sign Rust's own float grammar accepts, so this cannot fail.
    trimmed.parse::<f64>().unwrap_or(f64::NAN)
}

/// An unsigned integer literal in `radix` (16, 8, or 2 — whatever the
/// caller's prefix implied); `NaN` if `digits` is empty or any character is
/// out of range for the radix.
fn parse_non_decimal(digits: &str, radix: u32) -> f64 {
    if digits.is_empty() || !digits.chars().all(|c| c.is_digit(radix)) {
        return f64::NAN;
    }
    digits.chars().fold(0.0, |acc, c| {
        acc * radix as f64 + c.to_digit(radix).unwrap() as f64
    })
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
    use crate::vm::{
        ecma_whitespace::is_ecma_whitespace,
        number_coercion::{string_to_number, to_f64},
    };

    #[test]
    fn test() {
        assert_eq!(to_f64(true), 1.0);
        assert_eq!(to_f64(false), 0.0);
    }

    #[test]
    fn empty_and_decimal() {
        assert_eq!(string_to_number(""), 0.0);
        assert_eq!(string_to_number("5"), 5.0);
        assert_eq!(string_to_number("5."), 5.0);
        assert_eq!(string_to_number(".5"), 0.5);
        assert_eq!(string_to_number("-5.5e2"), -550.0);
        assert_eq!(string_to_number("+5"), 5.0);
    }

    #[test]
    fn non_decimal_literals() {
        assert_eq!(string_to_number("0x10"), 16.0);
        assert_eq!(string_to_number("0X1A"), 26.0);
        assert_eq!(string_to_number("0o10"), 8.0);
        assert_eq!(string_to_number("0b10"), 2.0);
        // No `Sign` production for the non-decimal forms.
        assert!(string_to_number("-0x10").is_nan());
        assert!(string_to_number("0x").is_nan());
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
    fn trims_ecma_whitespace_not_nel() {
        let trim = |s: &str| string_to_number(s.trim_matches(is_ecma_whitespace));
        // U+FEFF (BOM) is ECMA-262 `WhiteSpace`; U+0085 (NEL) is not, even
        // though Rust's `char::is_whitespace()` disagrees both ways.
        assert_eq!(trim("\u{FEFF}1"), 1.0);
        assert!(trim("\u{0085}1").is_nan());
    }
}
