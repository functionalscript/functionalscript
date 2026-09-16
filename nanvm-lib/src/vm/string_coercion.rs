use crate::vm::{
    Array, BigInt, Function, IVm, Object, String, ToAny, any::Any, dispatch::Dispatch,
    nullish::Nullish, primitive::Primitive, primitive_coercion::ToPrimitivePreferredType,
};

/// Coerces the value to a `String16<A>`, possibly producing an error result.
/// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion>
/// <https://tc39.es/ecma262/#sec-tostring>
///
/// It equals to `self + ''` in JavaScript.
///
/// Notes:
/// 1. It can throw an error. For example: `{ toString: () => { throw 0 } } + ''`
pub struct StringCoercion;

fn any_to_string<A: IVm>(a: Any<A>) -> Result<String<A>, Any<A>> {
    // https://tc39.es/ecma262/#sec-tostring - starting from point 10:
    // 10. Let primValue be ? ToPrimitive(argument, STRING).
    // (here we call to_primitive with preferred type String)
    // 11. Assert: primValue is not an Object.
    // (handled by to_primitive)
    // 12. Return ? ToString(primValue).
    // (handled by calls to relevant methods of StringCoercion)
    match a.to_primitive(Some(ToPrimitivePreferredType::String))? {
        Primitive::Nullish(n) => StringCoercion.nullish(n),
        Primitive::Boolean(b) => StringCoercion.bool(b),
        Primitive::Number(n) => StringCoercion.number(n),
        Primitive::String(s) => StringCoercion.string(s),
        Primitive::BigInt(bi) => StringCoercion.bigint(bi),
    }
}

impl<A: IVm> Dispatch<A> for StringCoercion {
    type Result = Result<String<A>, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        to_result(match v {
            Nullish::Null => "null",
            Nullish::Undefined => "undefined",
        })
    }

    fn bool(self, v: bool) -> Self::Result {
        to_result(match v {
            true => "true",
            false => "false",
        })
    }

    fn number(self, v: f64) -> Self::Result {
        Ok(number_to_string(v))
    }

    fn string(self, v: String<A>) -> Self::Result {
        Ok(v)
    }

    fn bigint(self, v: BigInt<A>) -> Self::Result {
        to_result(&v.to_string())
    }

    fn object(self, v: Object<A>) -> Self::Result {
        any_to_string(v.to_any())
    }

    fn array(self, v: Array<A>) -> Self::Result {
        any_to_string(v.to_any())
    }

    fn function(self, v: Function<A>) -> Self::Result {
        any_to_string(v.to_any())
    }
}

fn to_result<A: IVm>(s: &str) -> Result<String<A>, Any<A>> {
    Ok(s.into())
}

/// `ToString` restricted to `Number`, infallible unlike the full coercion
/// (`StringCoercion::number` above is the one throwable-`Result` wrapper
/// around it) — also reused directly by `Object::member_access`
/// (`vm/object/member_access.rs`) to stringify a numeric key before a
/// plain-object lookup, the same way real JS's `ToPropertyKey` runs ahead
/// of `[[Get]]`.
///
/// <https://tc39.es/ecma262/#sec-numeric-types-number-tostring> — deliberately
/// *not* `v.to_string()`: `f64`'s own `Display` never switches to exponential
/// notation, so `(1e21).to_string()` is a 22-digit integer where JS gives
/// `"1e+21"`, and `(1e-7).to_string()` is `"0.0000001"` where JS gives
/// `"1e-7"`. `js_digits_to_string` below applies the spec's own notation
/// rule to the digits Rust already computes.
pub(crate) fn number_to_string<A: IVm>(v: f64) -> String<A> {
    match v {
        f64::INFINITY => "Infinity".into(),
        f64::NEG_INFINITY => "-Infinity".into(),
        v if v.is_nan() => "NaN".into(),
        0.0 => "0".into(),
        v if v < 0.0 => format!("-{}", js_digits_to_string(-v)).as_str().into(),
        v => js_digits_to_string(v).as_str().into(),
    }
}

/// The digit-and-notation half of `Number::toString`, for a finite,
/// positive, nonzero `v`: plain integer, plain decimal, or exponential.
/// Rust's `{:e}` formatting already computes the shortest round-tripping
/// decimal digit sequence — the same one `{}` uses internally — as a
/// normalized `d[.ddd]e<exp>` mantissa. Stripping the point out of that
/// mantissa gives the spec's own `digits` (`k` of them); its `n` is one
/// more than Rust's `exp`, since the spec fixes the decimal point after
/// all `k` digits rather than after the first one:
/// `digits * 10^(n-k) = digits * 10^(exp-k+1)`.
fn js_digits_to_string(v: f64) -> std::string::String {
    let sci = format!("{v:e}");
    let (mantissa, exp) = sci.split_once('e').expect("`{:e}` always has an 'e'");
    let digits: std::string::String = mantissa.chars().filter(|&c| c != '.').collect();
    let k = digits.len() as i64;
    let n = exp.parse::<i64>().expect("`{:e}`'s exponent is an integer") + 1;

    if k <= n && n <= 21 {
        digits + &"0".repeat((n - k) as usize)
    } else if 0 < n && n <= 21 {
        let (head, tail) = digits.split_at(n as usize);
        format!("{head}.{tail}")
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat((-n) as usize))
    } else {
        let e = n - 1;
        let sign = if e < 0 { "-" } else { "+" };
        if k == 1 {
            format!("{digits}e{sign}{}", e.abs())
        } else {
            let (first, rest) = digits.split_at(1);
            format!("{first}.{rest}e{sign}{}", e.abs())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::number_to_string;
    use crate::naive::Naive;

    type A = Naive;

    fn check(v: f64, expected: &str) {
        assert_eq!(
            std::string::String::from(number_to_string::<A>(v)),
            expected,
            "number_to_string({v:e})"
        );
    }

    /// The exact boundaries a review on this helper's extraction named:
    /// `1e21`/`1e-7` are JS's first exponential values on the high/low
    /// side, `1e20`/`1e-6` are the adjacent plain-notation ones.
    #[test]
    fn exponential_notation_boundaries() {
        check(1e21, "1e+21");
        check(1e20, "100000000000000000000");
        check(1e-7, "1e-7");
        check(1e-6, "0.000001");
        check(-1e21, "-1e+21");
        check(-1e-7, "-1e-7");
    }

    #[test]
    fn plain_notation() {
        check(0.0, "0");
        check(-0.0, "0");
        check(1.0, "1");
        check(100.0, "100");
        check(123.456, "123.456");
        check(0.1, "0.1");
        check(0.5, "0.5");
        check(-456.0, "-456");
    }

    #[test]
    fn extreme_magnitudes() {
        check(f64::MAX, "1.7976931348623157e+308");
        check(5e-324, "5e-324"); // the smallest positive denormal
        check(1.5e300, "1.5e+300");
    }

    #[test]
    fn non_finite_and_nan() {
        check(f64::INFINITY, "Infinity");
        check(f64::NEG_INFINITY, "-Infinity");
        check(f64::NAN, "NaN");
    }
}
