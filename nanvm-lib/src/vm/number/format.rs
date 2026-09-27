//! `Number.prototype`'s formatters — `toFixed`, `toExponential`,
//! `toPrecision` — and `toString` with a radix. The three formatters round
//! the double's exact binary value, `mantissa × 2^exp2`, with a tie going
//! to the larger digit string, as the specification says ("if there are
//! two such n, pick the larger n"). Rust's own `format!("{:.2}", x)` rounds
//! half to even and so answers `"2"` for `(2.5).toFixed(0)` where
//! JavaScript answers `"3"`; the arithmetic here is `BigInt<A>`'s, as
//! `round_tie_to_even` in `vm/string_coercion.rs` already does for
//! `Number::toString`.

use super::Number;
use crate::vm::{
    Any, BigInt, IVm, String,
    string_coercion::{mantissa_exp2, number_to_string, shortest_digits},
};

/// The `RangeError` for a digit count or radix out of its range.
fn out_of_range<A: IVm>(name: &str, low: u32, high: u32) -> Any<A> {
    format!("RangeError: {name}() argument must be between {low} and {high}")
        .as_str()
        .into()
}

fn big<A: IVm>(v: u64) -> BigInt<A> {
    BigInt::from(v)
}

fn pow2<A: IVm>(e: u32) -> BigInt<A> {
    (big::<A>(1) << big(u64::from(e))).expect("a double's exponent is far under the size limit")
}

fn pow10<A: IVm>(e: u32) -> BigInt<A> {
    big::<A>(10)
        .pow(big(u64::from(e)))
        .expect("a non-negative exponent")
}

/// `n`, the integer closest to `x × 10^s` for a finite `x ≥ 0`, the larger on
/// a tie, computed exactly: `x` is `mantissa × 2^exp2`, both sides are
/// cross-multiplied so nothing is divided but the one `div_mod`, and a
/// remainder of at least half the divisor rounds up.
fn scaled<A: IVm>(x: f64, s: i64) -> BigInt<A> {
    let (mantissa, exp2) = mantissa_exp2(x);
    let (num2, den2) = if exp2 >= 0 {
        (pow2::<A>(exp2 as u32), big(1))
    } else {
        (big(1), pow2::<A>(exp2.unsigned_abs()))
    };
    let (num10, den10) = if s >= 0 {
        (pow10::<A>(s as u32), big(1))
    } else {
        (big(1), pow10::<A>(s.unsigned_abs() as u32))
    };
    let num = big::<A>(mantissa) * num2 * num10;
    let den = den2 * den10;
    let (q, r) = num.div_mod(den.clone()).expect("a power is not zero");
    if r * big(2) >= den { q + big(1) } else { q }
}

/// `e` and the `digits`-digit `n` with `n × 10^(e − digits + 1)` closest to
/// the finite `x > 0`, the larger `n` on a tie: the significand
/// `toExponential` and `toPrecision` print. `e` starts at the exponent of
/// `x`'s shortest decimal form and moves by one when rounding lands `n`
/// outside `[10^(digits−1), 10^digits)` — a double just below a power of
/// ten, or one that rounds up to it.
fn significand<A: IVm>(x: f64, digits: u32) -> (std::string::String, i64) {
    let at = |e: i64| scaled::<A>(x, i64::from(digits) - 1 - e);
    let low = pow10::<A>(digits - 1);
    let high = pow10::<A>(digits);
    let e = shortest_digits::<A>(x).1 - 1;
    let n = at(e);
    let (n, e) = if n >= high {
        (at(e + 1), e + 1)
    } else if n < low {
        let below = at(e - 1);
        if below >= high {
            (low, e)
        } else {
            (below, e - 1)
        }
    } else {
        (n, e)
    };
    (n.to_string(), e)
}

/// `e+N` or `e-N`, the exponent as the formatters write it.
fn exponent(e: i64) -> std::string::String {
    format!("e{}{}", if e < 0 { '-' } else { '+' }, e.abs())
}

/// `digits` with a point after the first.
fn point_after_first(digits: &str) -> std::string::String {
    if digits.len() == 1 {
        digits.into()
    } else {
        format!("{}.{}", &digits[..1], &digits[1..])
    }
}

impl Number {
    /// `Number.prototype.toFixed(f)`
    /// (<https://tc39.es/ecma262/#sec-number.prototype.tofixed>) over a digit
    /// count already converted by `ToIntegerOrInfinity`. The range is
    /// checked before the number is looked at, so `Infinity.toFixed(101)`
    /// throws. A non-finite number, and one of magnitude at least `10²¹`, is
    /// its `ToString`. The sign is the number's own, so `-0` is `"0.00"` and
    /// `-1e-7` is `"-0.00"`.
    pub(crate) fn to_fixed<A: IVm>(self, f: f64) -> Result<String<A>, Any<A>> {
        if !(0.0..=100.0).contains(&f) {
            return Err(out_of_range("toFixed", 0, 100));
        }
        let x = f64::from(self);
        if !x.is_finite() || x.abs() >= 1e21 {
            return Ok(number_to_string(self));
        }
        let f = f as u32;
        let sign = if x < 0.0 { "-" } else { "" };
        let m = scaled::<A>(x.abs(), i64::from(f)).to_string();
        let m = if f == 0 {
            m
        } else {
            let m = format!(
                "{}{m}",
                "0".repeat((f as usize + 1).saturating_sub(m.len()))
            );
            let (a, b) = m.split_at(m.len() - f as usize);
            format!("{a}.{b}")
        };
        Ok(format!("{sign}{m}").as_str().into())
    }

    /// `Number.prototype.toExponential(f)`
    /// (<https://tc39.es/ecma262/#sec-number.prototype.toexponential>) over a
    /// digit count converted by `ToIntegerOrInfinity`, or `None` for an
    /// `undefined` one. A non-finite number is its `ToString`, checked
    /// before the range, so `Infinity.toExponential(101)` is `"Infinity"`.
    /// `None` means as many digits as the shortest round-tripping form has.
    pub(crate) fn to_exponential<A: IVm>(self, f: Option<f64>) -> Result<String<A>, Any<A>> {
        let x = f64::from(self);
        if !x.is_finite() {
            return Ok(number_to_string(self));
        }
        if f.is_some_and(|f| !(0.0..=100.0).contains(&f)) {
            return Err(out_of_range("toExponential", 0, 100));
        }
        let sign = if x < 0.0 { "-" } else { "" };
        let x = x.abs();
        let (digits, e) = match f {
            _ if x == 0.0 => ("0".repeat(f.map_or(1, |f| f as usize + 1)), 0),
            None => {
                let (digits, n) = shortest_digits::<A>(x);
                (digits, n - 1)
            }
            Some(f) => significand::<A>(x, f as u32 + 1),
        };
        Ok(
            format!("{sign}{}{}", point_after_first(&digits), exponent(e))
                .as_str()
                .into(),
        )
    }

    /// `Number.prototype.toPrecision(p)`
    /// (<https://tc39.es/ecma262/#sec-number.prototype.toprecision>) over a
    /// precision converted by `ToIntegerOrInfinity`; an `undefined` one is
    /// the caller's `ToString`. A non-finite number is its `ToString`, then
    /// `p` must be `1` to `100`. The digits are written with an exponent when
    /// it is below `-6` or at least `p`, and plainly otherwise.
    pub(crate) fn to_precision<A: IVm>(self, p: f64) -> Result<String<A>, Any<A>> {
        let x = f64::from(self);
        if !x.is_finite() {
            return Ok(number_to_string(self));
        }
        if !(1.0..=100.0).contains(&p) {
            return Err(out_of_range("toPrecision", 1, 100));
        }
        let p = p as u32;
        let sign = if x < 0.0 { "-" } else { "" };
        let x = x.abs();
        let (m, e) = if x == 0.0 {
            ("0".repeat(p as usize), 0)
        } else {
            significand::<A>(x, p)
        };
        let text = if e < -6 || e >= i64::from(p) {
            format!("{}{}", point_after_first(&m), exponent(e))
        } else if e == i64::from(p) - 1 {
            m
        } else if e >= 0 {
            let (a, b) = m.split_at(e as usize + 1);
            format!("{a}.{b}")
        } else {
            format!("0.{}{m}", "0".repeat((-(e + 1)) as usize))
        };
        Ok(format!("{sign}{text}").as_str().into())
    }

    /// `Number::toString(x, radix)` for a radix other than ten, already
    /// checked to be `2` to `36`. `NaN` and the infinities are as in radix
    /// ten, and an integer converts exactly — `mantissa × 2^exp2` is an
    /// integer `BigInt` then. A number with a fraction is refused:
    /// ECMAScript leaves its digits in another radix to the engine
    /// (`vm/string/README.md`).
    pub(crate) fn to_radix_string<A: IVm>(self, radix: u32) -> Result<String<A>, Any<A>> {
        let x = f64::from(self);
        if !x.is_finite() {
            return Ok(number_to_string(self));
        }
        if x == 0.0 {
            return Ok("0".into());
        }
        if x.fract() != 0.0 {
            return Err(
                "RangeError: a fraction's digits in a radix other than 10 are not supported".into(),
            );
        }
        let (mantissa, exp2) = mantissa_exp2(x.abs());
        let magnitude = if exp2 >= 0 {
            big::<A>(mantissa) * pow2(exp2 as u32)
        } else {
            big::<A>(mantissa >> exp2.unsigned_abs())
        };
        let digits = magnitude.to_radix_string(radix);
        let sign = if x < 0.0 { "-" } else { "" };
        Ok(format!("{sign}{digits}").as_str().into())
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Number, String},
    };

    type A = Naive;

    fn fixed(x: f64, f: f64) -> String<A> {
        Number::from(x).to_fixed(f).unwrap()
    }
    fn exponential(x: f64, f: Option<f64>) -> String<A> {
        Number::from(x).to_exponential(f).unwrap()
    }
    fn precision(x: f64, p: f64) -> String<A> {
        Number::from(x).to_precision(p).unwrap()
    }

    #[test]
    fn to_fixed() {
        assert_eq!(fixed(0.5, 0.0), "1".into());
        assert_eq!(fixed(2.5, 0.0), "3".into());
        assert_eq!(fixed(1.25, 1.0), "1.3".into());
        assert_eq!(fixed(1.005, 2.0), "1.00".into());
        assert_eq!(fixed(-1.5, 0.0), "-2".into());
        assert_eq!(fixed(-0.0, 2.0), "0.00".into());
        assert_eq!(fixed(-1e-7, 2.0), "-0.00".into());
        assert_eq!(fixed(1e21, 2.0), "1e+21".into());
        assert_eq!(fixed(0.1, 25.0), "0.1000000000000000055511151".into());
        assert!(Number::from(f64::INFINITY).to_fixed::<A>(101.0).is_err());
        assert!(Number::from(1.0).to_fixed::<A>(-1.0).is_err());
    }

    #[test]
    fn to_exponential() {
        assert_eq!(exponential(123456.0, Some(2.0)), "1.23e+5".into());
        assert_eq!(exponential(123456.0, None), "1.23456e+5".into());
        assert_eq!(exponential(0.0, Some(2.0)), "0.00e+0".into());
        assert_eq!(exponential(0.0, None), "0e+0".into());
        assert_eq!(exponential(1.25, Some(1.0)), "1.3e+0".into());
        assert_eq!(exponential(-0.00015, Some(1.0)), "-1.5e-4".into());
        assert_eq!(exponential(9.99, Some(1.0)), "1.0e+1".into());
        assert_eq!(
            exponential(1e23, Some(20.0)),
            "9.99999999999999916114e+22".into()
        );
        assert_eq!(exponential(5e-324, Some(2.0)), "4.94e-324".into());
        assert_eq!(exponential(f64::INFINITY, Some(101.0)), "Infinity".into());
        assert!(Number::from(1.0).to_exponential::<A>(Some(101.0)).is_err());
    }

    #[test]
    fn to_precision() {
        assert_eq!(precision(123.456, 4.0), "123.5".into());
        assert_eq!(precision(0.000123, 2.0), "0.00012".into());
        assert_eq!(precision(123456.0, 2.0), "1.2e+5".into());
        assert_eq!(precision(0.0, 3.0), "0.00".into());
        assert_eq!(precision(1e-7, 1.0), "1e-7".into());
        assert_eq!(precision(-0.0, 2.0), "0.0".into());
        assert_eq!(precision(99.99, 3.0), "100".into());
        assert!(Number::from(1.0).to_precision::<A>(0.0).is_err());
        assert_eq!(precision(f64::NAN, 0.0), "NaN".into());
    }

    #[test]
    fn radix() {
        let r = |x: f64, radix: u32| Number::from(x).to_radix_string::<A>(radix);
        assert_eq!(r(255.0, 16), Ok("ff".into()));
        assert_eq!(r(-255.0, 2), Ok("-11111111".into()));
        assert_eq!(r(1e21, 16), Ok("3635c9adc5dea00000".into()));
        assert_eq!(r(2f64.powi(60), 16), Ok("1000000000000000".into()));
        assert_eq!(r(-0.0, 2), Ok("0".into()));
        assert_eq!(r(f64::NAN, 2), Ok("NaN".into()));
        assert!(r(0.5, 2).is_err());
    }
}
