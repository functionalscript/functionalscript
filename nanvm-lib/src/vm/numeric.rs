use core::cmp::Ordering;
use std::ops::{Add, BitAnd, BitOr, BitXor, Div, Mul, Neg, Rem, Shl, Shr, Sub};

use crate::vm::{Any, BigInt, IVm, Number, Unpacked, error};

/// `ToUint32(rhs) & 0x1F`: the shift-count operand of `<<`/`>>`/`>>>`
/// between two `Number`s is reduced modulo 32 — a `u32` shift always in
/// `0..=31`, so it can never panic Rust's own `<<`/`>>` on `i32`/`u32`
/// (which requires a shift strictly less than the type's 32-bit width, i.e.
/// at most 31).
fn shift_count(rhs: Number) -> u32 {
    rhs.to_uint32() & 0x1F
}

/// <https://tc39.es/ecma262/#sec-tonumeric>
/// Represents ECMAScript numeric types, i.e. `Number` or `BigInt`, as defined by ToNumeric.
#[allow(dead_code)]
#[derive(Debug, PartialEq, Clone)]
pub enum Numeric<A: IVm> {
    Number(Number),
    BigInt(BigInt<A>),
}

impl<A: IVm> From<Numeric<A>> for Unpacked<A> {
    fn from(value: Numeric<A>) -> Self {
        match value {
            Numeric::Number(value) => Unpacked::Number(value),
            Numeric::BigInt(value) => Unpacked::BigInt(value),
        }
    }
}

impl<A: IVm> Neg for Numeric<A> {
    type Output = Self;

    fn neg(self) -> Self::Output {
        match self {
            Numeric::Number(value) => Numeric::Number(-value),
            Numeric::BigInt(value) => Numeric::BigInt(-value),
        }
    }
}

impl<A: IVm> Add for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn add(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Numeric::Number(a + b),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a + b),
            _ => return Err(error::mixed_numeric_operands()),
        })
    }
}

impl<A: IVm> Mul for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Numeric::Number(a * b),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a * b),
            _ => return Err(error::mixed_numeric_operands()),
        })
    }
}

impl<A: IVm> Sub for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn sub(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Numeric::Number(a - b),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a - b),
            _ => return Err(error::mixed_numeric_operands()),
        })
    }
}

impl<A: IVm> Rem for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn rem(self, rhs: Self) -> Self::Output {
        match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Ok(Numeric::Number(a % b)),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Ok(Numeric::BigInt((a % b)?)),
            _ => Err(error::mixed_numeric_operands()),
        }
    }
}

impl<A: IVm> Div for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn div(self, rhs: Self) -> Self::Output {
        match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Ok(Numeric::Number(a / b)),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Ok(Numeric::BigInt((a / b)?)),
            _ => Err(error::mixed_numeric_operands()),
        }
    }
}

impl<A: IVm> BitAnd for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn bitand(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => {
                Numeric::Number((a.to_int32() & b.to_int32()).into())
            }
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a & b),
            _ => return Err(error::mixed_numeric_operands()),
        })
    }
}

impl<A: IVm> BitOr for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn bitor(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => {
                Numeric::Number((a.to_int32() | b.to_int32()).into())
            }
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a | b),
            _ => return Err(error::mixed_numeric_operands()),
        })
    }
}

impl<A: IVm> BitXor for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn bitxor(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => {
                Numeric::Number((a.to_int32() ^ b.to_int32()).into())
            }
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a ^ b),
            _ => return Err(error::mixed_numeric_operands()),
        })
    }
}

impl<A: IVm> Shl for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn shl(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => {
                Numeric::Number((a.to_int32() << shift_count(b)).into())
            }
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt((a << b)?),
            _ => return Err(error::mixed_numeric_operands()),
        })
    }
}

impl<A: IVm> Shr for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn shr(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => {
                Numeric::Number((a.to_int32() >> shift_count(b)).into())
            }
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt((a >> b)?),
            _ => return Err(error::mixed_numeric_operands()),
        })
    }
}

impl<A: IVm> Numeric<A> {
    /// `**`. Not a `core::ops` trait — Rust has no operator for
    /// exponentiation, so this is a plain method, the same as `Any::pow`
    /// one level up.
    pub fn pow(self, rhs: Self) -> Result<Self, Any<A>> {
        match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Ok(Numeric::Number(a.pow(b))),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Ok(Numeric::BigInt(a.pow(b)?)),
            _ => Err(error::mixed_numeric_operands()),
        }
    }

    /// `~`. Not a `core::ops` trait — `Not` is already claimed by `Any`'s
    /// logical `!` one level up — so this is a plain method, the same as
    /// `pow`. Number: `ToInt32` then bitwise-negate. BigInt: `-x - 1`, the
    /// exact spec identity (`BigInt::unaryMinus`/`Number::subtract` on the
    /// existing `Neg`/`Sub` impls), reusing them instead of a new
    /// two's-complement algorithm.
    pub fn bitwise_not(self) -> Self {
        match self {
            Numeric::Number(v) => Numeric::Number((!v.to_int32()).into()),
            Numeric::BigInt(v) => Numeric::BigInt(-v - BigInt::from(1u64)),
        }
    }

    /// `>>>`. Not a `core::ops` trait — Rust has no unsigned-right-shift
    /// operator, so this is a plain method, the same as `pow`/`bitwise_not`.
    /// Number: `ToUint32` both sides (unlike `<<`/`>>`'s `ToInt32` on the
    /// left — this is the one shift whose left operand's sign bit is never
    /// preserved), then a logical (zero-filling) shift. BigInt: always
    /// throws — arbitrary-precision integers have no fixed width for an
    /// "unsigned" shift to be relative to.
    pub fn unsigned_right_shift(self, rhs: Self) -> Result<Self, Any<A>> {
        match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => {
                Ok(Numeric::Number((a.to_uint32() >> shift_count(b)).into()))
            }
            (Numeric::BigInt(_), Numeric::BigInt(_)) => Err(error::bigint_unsigned_right_shift()),
            _ => Err(error::mixed_numeric_operands()),
        }
    }

    /// The order of `self` relative to `other` that `<`, `>`, `<=` and `>=`
    /// read: [`IsLessThan`](https://tc39.es/ecma262/#sec-islessthan)'s
    /// numeric steps, with its `undefined` as `None`, which is where a `NaN`
    /// takes part. A `Number` and a `BigInt` are compared exactly.
    ///
    /// An inherent method, not `PartialOrd`: `PartialOrd` must agree with
    /// `PartialEq`, which tells `Number(1.0)` from `BigInt(1)` by variant
    /// where this answers `Equal`, as JavaScript's `<=` does.
    pub fn compare(&self, other: &Self) -> Option<Ordering> {
        match (self, other) {
            // `Number`'s partial order is IEEE 754's: a `NaN` compares with
            // nothing.
            (Numeric::Number(a), Numeric::Number(b)) => a.partial_cmp(b),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Some(a.cmp(b)),
            (Numeric::BigInt(a), Numeric::Number(b)) => partial_cmp_bigint_number(a, *b),
            (Numeric::Number(a), Numeric::BigInt(b)) => {
                partial_cmp_bigint_number(b, *a).map(Ordering::reverse)
            }
        }
    }
}

/// The order of `bi` relative to `f`, `None` where `f` is `NaN`; the
/// infinities order against any bigint. Otherwise the exact mathematical
/// comparison IsLessThan's step (k) asks for, not `bi.to_f64() < f`, which
/// would round `bi` and could be wrong for a magnitude a `f64` mantissa can't
/// hold exactly. `bi`'s order against `f.floor()` (itself exact, via
/// [`whole_f64_to_bigint`]) settles it, except when they're equal: `f` is
/// still strictly greater whenever it has a fractional part.
fn partial_cmp_bigint_number<A: IVm>(bi: &BigInt<A>, f: Number) -> Option<Ordering> {
    if f.is_nan() {
        return None;
    }
    if !f.is_finite() {
        return Some(if f > 0.into() {
            Ordering::Less
        } else {
            Ordering::Greater
        });
    }
    let f: f64 = f.into();
    let floor = f.floor();
    Some(match bi.cmp(&whole_f64_to_bigint::<A>(floor)) {
        Ordering::Equal if f != floor => Ordering::Less,
        order => order,
    })
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
    use core::cmp::Ordering;

    use crate::{
        naive::Naive,
        vm::{BigInt, numeric::Numeric},
    };

    type A = Naive;

    fn n(v: f64) -> Numeric<A> {
        Numeric::Number(v.into())
    }

    fn big(v: i64) -> Numeric<A> {
        Numeric::BigInt(v.into())
    }

    /// `compare` in both operand orders: the second is the first reversed.
    fn both(a: &Numeric<A>, b: &Numeric<A>) -> Option<Ordering> {
        let order = a.compare(b);
        assert_eq!(b.compare(a), order.map(Ordering::reverse));
        order
    }

    #[test]
    fn number_number() {
        assert_eq!(both(&n(1.0), &n(2.0)), Some(Ordering::Less));
        assert_eq!(both(&n(2.0), &n(2.0)), Some(Ordering::Equal));
        assert_eq!(both(&n(f64::NAN), &n(1.0)), None);
    }

    #[test]
    fn bigint_bigint() {
        assert_eq!(both(&big(-3), &big(2)), Some(Ordering::Less));
        assert_eq!(both(&big(2), &big(2)), Some(Ordering::Equal));
    }

    #[test]
    fn bigint_nan() {
        assert_eq!(both(&big(0), &n(f64::NAN)), None);
    }

    #[test]
    fn bigint_infinities() {
        assert_eq!(both(&big(5), &n(f64::INFINITY)), Some(Ordering::Less));
        assert_eq!(
            both(&big(5), &n(f64::NEG_INFINITY)),
            Some(Ordering::Greater)
        );
    }

    #[test]
    fn bigint_finite() {
        assert_eq!(both(&big(5), &n(5.0)), Some(Ordering::Equal));
        assert_eq!(both(&big(5), &n(5.5)), Some(Ordering::Less));
        assert_eq!(both(&big(5), &n(4.5)), Some(Ordering::Greater));
        assert_eq!(both(&big(-5), &n(-4.5)), Some(Ordering::Less));
        assert_eq!(both(&big(0), &n(-0.0)), Some(Ordering::Equal));
    }

    #[test]
    fn large_bigint_exact() {
        // 2^60 vs 2^60 + 2048 as a whole f64 (both exactly representable):
        // rounding the `BigInt` to `f64` first could compare equal instead.
        let b = Numeric::BigInt(BigInt::<A>::from(1u64 << 60));
        assert_eq!(
            both(&b, &n((1u64 << 60) as f64 + 2048.0)),
            Some(Ordering::Less)
        );
    }
}
