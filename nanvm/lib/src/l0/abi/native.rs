//! L1's native rows over handles: the functions a compiled program imports
//! from `fjs:l1-native`
//! ([`fjs/ir/native`](../../../../../fjs/ir/native/module.f.js)), each with
//! the JavaScript semantics of its row in
//! [`fjs/wasm/runtime/l1/native`](../../../../../fjs/wasm/runtime/l1/native/module.f.js),
//! computed by NaNVM's own operators (IR slice 12c).
//!
//! A row borrows the handles it takes and answers an owned one, as L0's
//! functions do. Where its JavaScript body throws `l1.<name>: <reason>`, a
//! precondition, it traps with that text. A throw of the language, the
//! `RangeError` of a bigint division by zero or of a bigint past NaNVM's
//! size limit, is a [`throw`] of NaNVM's value of it, which is L1's.

#[cfg(test)]
mod test;

use super::{get, put, throw};
use crate::vm::{Any, BigInt, Number, ToAny, Unpacked};

type V = Any<crate::naive::Naive>;
type B = BigInt<crate::naive::Naive>;

/// The panic of a broken precondition of row `name`.
fn trap(name: &str, reason: &str) -> ! {
    panic!("l1.{name}: {reason}")
}

fn bigint(name: &str, h: i64) -> B {
    get(name, h)
        .try_into()
        .unwrap_or_else(|_| trap(name, "not a bigint"))
}

fn string(name: &str, h: i64) -> V {
    let v = get(name, h);
    match Unpacked::from(v.clone()) {
        Unpacked::String(_) => v,
        _ => trap(name, "not a string"),
    }
}

/// An owned handle of a row's value, or a [`throw`] of what it threw.
fn answer(r: Result<V, V>) -> i64 {
    match r {
        Ok(v) => put(v),
        Err(e) => throw(put(e)),
    }
}

/// `===` of two bigints.
pub fn bigint_equals(a: i64, b: i64) -> i32 {
    (bigint("bigintEquals", a) == bigint("bigintEquals", b)) as i32
}

/// `%` of two numbers: Rust's `%` of `f64` is IEEE `fmod`, which is
/// `Number::remainder`: the dividend's sign, and `NaN` for a zero divisor
/// or an infinite dividend.
pub fn number_remainder(a: f64, b: f64) -> f64 {
    a % b
}

/// `>>` of two numbers: `ToInt32` of the first, shifted right by the low
/// five bits of `ToUint32` of the second, with its sign.
pub fn number_shift_right(a: f64, b: f64) -> f64 {
    f64::from(Number::from(a).to_int32() >> (Number::from(b).to_uint32() & 31))
}

/// `&` of two numbers, each `ToInt32`.
pub fn number_and(a: f64, b: f64) -> f64 {
    f64::from(Number::from(a).to_int32() & Number::from(b).to_int32())
}

/// `String(n)`: `Number::toString` in radix 10.
pub fn number_to_string(n: f64) -> i64 {
    answer(
        Number::from(n)
            .to_any::<crate::naive::Naive>()
            .to_string()
            .map(|s| s.to_any()),
    )
}

/// `Number(s)` of a string: `StringToNumber`.
pub fn string_to_number(s: i64) -> f64 {
    let v = string("stringToNumber", s);
    f64::from(
        v.to_number()
            .unwrap_or_else(|_| trap("stringToNumber", "not a string")),
    )
}

/// `String(b)` of a bigint.
pub fn bigint_to_string(b: i64) -> i64 {
    let b = bigint("bigintToString", b);
    answer(b.to_any().to_string().map(|s| s.to_any()))
}

fn arithmetic(name: &str, a: i64, b: i64, f: impl FnOnce(B, B) -> Result<B, V>) -> i64 {
    let (x, y) = (bigint(name, a), bigint(name, b));
    answer(f(x, y).map(|r| r.to_any()))
}

/// `+` of two bigints.
pub fn bigint_add(a: i64, b: i64) -> i64 {
    arithmetic("bigintAdd", a, b, |x, y| x + y)
}

/// `-` of two bigints.
pub fn bigint_subtract(a: i64, b: i64) -> i64 {
    arithmetic("bigintSubtract", a, b, |x, y| x - y)
}

/// `*` of two bigints.
pub fn bigint_multiply(a: i64, b: i64) -> i64 {
    arithmetic("bigintMultiply", a, b, |x, y| x * y)
}

/// `/` of two bigints, truncated toward zero; a zero divisor throws.
pub fn bigint_divide(a: i64, b: i64) -> i64 {
    arithmetic("bigintDivide", a, b, |x, y| x / y)
}

/// `%` of two bigints, the dividend's sign; a zero divisor throws.
pub fn bigint_remainder(a: i64, b: i64) -> i64 {
    arithmetic("bigintRemainder", a, b, |x, y| x % y)
}

/// `>>` of two bigints, a floor division by a power of two; a negative
/// shift is a left shift, which throws past NaNVM's size limit.
pub fn bigint_shift_right(a: i64, b: i64) -> i64 {
    arithmetic("bigintShiftRight", a, b, |x, y| x >> y)
}

/// `&` of two bigints, as two's complement of infinite width.
pub fn bigint_and(a: i64, b: i64) -> i64 {
    arithmetic("bigintAnd", a, b, |x, y| Ok(x & y))
}

/// `Number(b)` of a bigint: the nearest number.
pub fn bigint_to_number(b: i64) -> f64 {
    f64::from(bigint("bigintToNumber", b).to_number())
}

/// Unary `-` of a bigint.
pub fn bigint_negate(a: i64) -> i64 {
    put((-bigint("bigintNegate", a)).to_any())
}

/// `IsLessThan` of two primitives, one at least a bigint and each a
/// bigint, a number or a string: `1` for less, `0` for not less, `-1` for
/// undefined, as `a < b ? 1 : a >= b ? 0 : -1` answers it. A string whose
/// bigint is past NaNVM's size limit throws NaNVM's `RangeError`, where
/// JavaScript would compare it.
pub fn bigint_less(a: i64, b: i64) -> f64 {
    let name = "bigintLess";
    let (x, y) = (get(name, a), get(name, b));
    let is_bigint = |v: &V| matches!(Unpacked::from(v.clone()), Unpacked::BigInt(_));
    let numeric = |v: &V| {
        matches!(
            Unpacked::from(v.clone()),
            Unpacked::BigInt(_) | Unpacked::Number(_) | Unpacked::String(_)
        )
    };
    // The order of the JavaScript body's checks.
    if !is_bigint(&x) && !is_bigint(&y) {
        trap(name, "not a bigint")
    }
    if !numeric(&x) || !numeric(&y) {
        trap(name, "not a numeric")
    }
    // a string past NaNVM's size limit of a bigint throws its `RangeError`
    let is = |r: Result<V, V>| r.unwrap_or_else(|e| throw(put(e))).to_boolean();
    if is(x.clone().lt(y.clone())) {
        1.0
    } else if is(x.ge(y)) {
        0.0
    } else {
        -1.0
    }
}
