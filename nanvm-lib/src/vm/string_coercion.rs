use core::cmp::Ordering;

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
        v if v < 0.0 => format!("-{}", js_digits_to_string::<A>(-v)).as_str().into(),
        v => js_digits_to_string::<A>(v).as_str().into(),
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
///
/// Rust's formatter picks *a* correctly-rounded, round-tripping `digits` —
/// but not always the spec's own one: when `v`'s exact binary value sits
/// precisely halfway between two equally-short round-tripping decimals,
/// `Number::toString` step 5 breaks the tie round-half-to-even, and Rust's
/// formatter can break it the other way. `round_tie_to_even` below corrects
/// exactly that case.
fn js_digits_to_string<A: IVm>(v: f64) -> std::string::String {
    let sci = format!("{v:e}");
    let (mantissa, exp) = sci.split_once('e').expect("`{:e}` always has an 'e'");
    let digits: std::string::String = mantissa.chars().filter(|&c| c != '.').collect();
    let k = digits.len() as i64;
    let n = exp.parse::<i64>().expect("`{:e}`'s exponent is an integer") + 1;

    let s = digits
        .parse::<u64>()
        .expect("`digits` is a run of ASCII decimal characters");
    let m = n - k;
    let (mant, exp2) = mantissa_exp2(v);
    let corrected = round_tie_to_even::<A>(v, mant, exp2, s, m);
    let (digits, k, n) = if corrected == s {
        (digits, k, n)
    } else {
        // A tie corrected at a power-of-10 boundary (`s` was e.g. `100` and
        // the even neighbor is `99`, or `999` and it's `1000`) changes the
        // digit count, so both are recomputed from `m` rather than patched:
        // `m` — the tie's own position — is unaffected by which of the two
        // adjacent candidates is chosen, only how many digits spell it.
        let digits = corrected.to_string();
        let k = digits.len() as i64;
        (digits, k, m + k)
    };

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

/// `v`'s exact value as `mantissa * 2^exp2` — the plain IEEE 754 binary64
/// decomposition (`mantissa` folds in the implicit leading bit for a normal
/// `v`, and is the raw significand for a subnormal one), used only by
/// [`round_tie_to_even`] below. Not reduced to lowest terms — `mantissa` may
/// have trailing zero bits, so `exp2` is not necessarily the *smallest*
/// exponent that works, only *a* correct one — but the tie-break comparison
/// that consumes it is exact either way, so reducing it first would only
/// spend work without changing the answer.
fn mantissa_exp2(v: f64) -> (u64, i32) {
    let bits = v.to_bits();
    let exponent_bits = (bits >> 52) & 0x7ff;
    let mantissa_bits = bits & 0xf_ffff_ffff_ffff;
    if exponent_bits == 0 {
        (mantissa_bits, -1074) // subnormal: no implicit leading bit
    } else {
        (mantissa_bits | (1u64 << 52), exponent_bits as i32 - 1075)
    }
}

/// The ECMA-262 `Number::toString` round-half-to-even tie-break: corrects
/// `s` (`digits` parsed as an integer) when `v`'s exact value —
/// `mantissa * 2^exp2` — sits precisely halfway between two `k`-digit
/// decimal candidates at scale `10^m` (`m` is the spec's `n - k`), which is
/// the one case where *a* correctly-rounded, round-tripping `s` (what
/// Rust's formatter guarantees) is not necessarily *the* spec-mandated one.
///
/// Exact arithmetic equidistance alone is not sufficient to switch, and
/// this has already broken twice by stopping one check short of the full
/// spec condition:
///
/// - An earlier attempt approximated "is this a tie" by checking only
///   whether `s`'s neighboring digit round-trips to `v`, with no
///   equidistance check at all, and produced false positives that broke
///   `Number.MAX_VALUE` and `Number.MIN_VALUE`.
/// - This function's own first version checked equidistance exactly (via
///   `BigInt<A>`, `nanvm-lib`'s own arbitrary-precision facility — reused
///   rather than adding a dependency, since `nanvm-lib` is
///   zero-dependency) but, on the strength of that alone, assumed the
///   neighboring candidate was automatically a legitimate one too. Found
///   in review: at a power-of-two boundary (`2^-24`, for one) the ULP
///   spacing changes, so a candidate decimal-equidistant from `v` in
///   *this* scale can round-trip to the float *below* `v` instead of to
///   `v` — `v`'s only valid `k`-digit representation is `s` itself, and
///   there never was a tie to break.
///
/// The two checks are independent and both required: equidistance decides
/// whether `v` is even a *candidate* for a tie (ruling out `MAX_VALUE`
/// /`MIN_VALUE`, where round-trip-only would false-positive), and the
/// neighbor's own round-trip decides whether it is *also* a legitimate
/// `k`-digit representation of `v` at all (ruling out `2^-24`, where
/// equidistance-only would false-positive) — ECMA-262's own definition of
/// a candidate `s` already requires "the Number value for `s *
/// 10^(n-k)` is `x`", so a neighbor that fails this was never a candidate
/// to tie-break between in the first place, no matter how exactly
/// equidistant it is in decimal.
fn round_tie_to_even<A: IVm>(v: f64, mantissa: u64, exp2: i32, s: u64, m: i64) -> u64 {
    let one = || BigInt::<A>::from(1u64);
    let pow2 = |e: i32| -> BigInt<A> {
        (one() << BigInt::from(e as u64))
            .expect("a binary64 exponent's magnitude is far under BigInt's size limit")
    };
    let pow10 = |e: i64| -> BigInt<A> {
        BigInt::<A>::from(10u64)
            .pow(BigInt::from(e as u64))
            .expect("`e` is non-negative by construction below")
    };
    // v == mantissa * 2^exp2 == (mantissa * v_extra) / v_den.
    let (v_extra, v_den) = if exp2 >= 0 {
        (pow2(exp2), one())
    } else {
        (one(), pow2(-exp2))
    };
    // A candidate's `target * 10^m == (target * s_extra) / s_den`.
    let (s_extra, s_den) = if m >= 0 {
        (pow10(m), one())
    } else {
        (one(), pow10(-m))
    };
    // Compares `2v` against `target * 10^m`, i.e. whether `v` is exactly
    // `target / 2` away from zero at this scale — the shared shape of both
    // tie checks below, cross-multiplied so no side is ever divided.
    let equidistant = |target: u64| -> bool {
        let v_num = BigInt::<A>::from(2 * mantissa) * v_extra.clone();
        let s_num = BigInt::<A>::from(target) * s_extra.clone();
        (v_num * s_den.clone()).cmp(&(s_num * v_den.clone())) == Ordering::Equal
    };
    // Whether `candidate * 10^m`, read back as a `Number` the way ECMA-262's
    // own candidate condition requires, is `v` itself and not some other
    // float — the guard `equidistant` alone cannot give.
    let is_legitimate_candidate = |candidate: u64| -> bool {
        format!("{candidate}e{m}")
            .parse::<f64>()
            .is_ok_and(|parsed| parsed == v)
    };
    if equidistant(2 * s - 1) {
        let candidate = s - 1;
        // v is exactly halfway between s-1 and s: keep whichever is both
        // even and a legitimate candidate — s already is (Rust guarantees
        // it), s-1 needs checking.
        return if candidate.is_multiple_of(2) && is_legitimate_candidate(candidate) {
            candidate
        } else {
            s
        };
    }
    if equidistant(2 * s + 1) {
        let candidate = s + 1;
        // Symmetric case: v is exactly halfway between s and s+1.
        return if candidate.is_multiple_of(2) && is_legitimate_candidate(candidate) {
            candidate
        } else {
            s
        };
    }
    s
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

    /// The three bit patterns a review found by differential-fuzzing against
    /// `node` over ~60k values: each is exactly halfway between two
    /// 17-digit round-tripping decimals, and Rust's formatter rounds away
    /// from zero where the spec's round-half-to-even keeps the even (here,
    /// lower) one.
    #[test]
    fn round_half_to_even_ties() {
        check(f64::from_bits(0xc23a0480a70a2400), "-111744689930.14062");
        check(f64::from_bits(0xc24e2a807a3c5a00), "-259124163704.70312");
        check(f64::from_bits(0xc24ed800216b1200), "-264945812182.14062");
    }

    /// Non-tie regression guards: an earlier, rejected fix attempt (see
    /// `round_tie_to_even`'s doc comment) approximated a tie by checking
    /// whether a neighboring digit also round-trips, which flagged both of
    /// these as false positives and corrupted them.
    #[test]
    fn non_tie_boundaries_unaffected() {
        check(f64::MAX, "1.7976931348623157e+308");
        check(f64::MIN_POSITIVE, "2.2250738585072014e-308");
        check(5e-324, "5e-324");
    }

    /// A review found this one: `2^-24`'s exact value sits precisely at the
    /// arithmetic decimal midpoint between two 17-digit candidates, exactly
    /// the condition `round_tie_to_even` checks first — but only one of the
    /// two, `...063`, is a real 17-digit representation of `2^-24` at all
    /// (`...062` round-trips to the float *below* it, since a power-of-two
    /// boundary is where binary64's ULP spacing changes). There was never a
    /// tie to break, and the round-trip guard is what tells the two cases
    /// apart from `round_half_to_even_ties` above, where both candidates are
    /// legitimate and the choice is real.
    #[test]
    fn power_of_two_boundary_is_not_a_tie() {
        check(2f64.powi(-24), "5.960464477539063e-8");
    }
}
