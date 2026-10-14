use super::BigInt;
use crate::{
    common::default::default,
    sign::Sign,
    vm::{IVm, Number},
};

impl<A: IVm> From<u64> for BigInt<A> {
    fn from(value: u64) -> Self {
        if value == 0 {
            return default();
        }
        Self::new_one(Sign::Positive, value)
    }
}

fn neg(i: i64) -> u64 {
    i.overflowing_neg().0 as u64
}

impl<A: IVm> From<i64> for BigInt<A> {
    fn from(value: i64) -> Self {
        if value >= 0 {
            return (value as u64).into();
        }
        Self::new_one(Sign::Negative, neg(value))
    }
}

impl<A: IVm> BigInt<A> {
    /// The exact `BigInt` of an integral, finite `n`, read from its binary64
    /// layout rather than any decimal round-trip: past `2^53` a `Number` is
    /// still an exact integer, one with known trailing zero bits. `-0` is
    /// `0n`.
    pub fn from_integral(n: Number) -> Self {
        debug_assert_eq!(f64::from(n).fract(), 0.0, "an integral Number");
        let (sign, significand, exponent) = n.decompose().expect("an integral Number is finite");
        let magnitude = if exponent >= 0 {
            (Self::from(significand) << Self::from(exponent as u64))
                .expect("a binary64's exponent is far under BigInt's size limit")
        } else {
            // The bits under the point are zeros, so dropping them is exact.
            // The shift reaches 64 or past it only for a zero.
            Self::from(
                significand
                    .checked_shr(exponent.unsigned_abs())
                    .unwrap_or(0),
            )
        };
        if sign == Sign::Negative {
            -magnitude
        } else {
            magnitude
        }
    }

    /// `2^e`, for an `e` a binary64's exact arithmetic reaches: a few
    /// thousand at most, far under `BigInt`'s size limit.
    pub(crate) fn pow2(e: u32) -> Self {
        (Self::from(1u64) << Self::from(u64::from(e)))
            .expect("a binary64's exponent is far under BigInt's size limit")
    }
}

#[cfg(test)]
mod test {
    use crate::{
        naive::Naive,
        sign::Sign,
        vm::{BigInt, Number, bigint::from::neg},
    };

    fn integral(v: f64) -> BigInt<Naive> {
        BigInt::from_integral(Number::from(v))
    }

    #[test]
    fn from_integral() {
        assert_eq!(integral(0.0), BigInt::default());
        assert_eq!(integral(-0.0), BigInt::default());
        assert_eq!(integral(1.0), BigInt::from(1u64));
        assert_eq!(integral(-3.0), BigInt::from(-3i64));
        // 2^53 and its even neighbor, past the integers every `Number` has.
        assert_eq!(integral(9_007_199_254_740_992.0), BigInt::from(1u64 << 53));
        assert_eq!(
            integral(9_007_199_254_740_994.0),
            BigInt::from((1u64 << 53) + 2)
        );
        assert_eq!(
            integral(-18_446_744_073_709_551_616.0),
            BigInt::normalize_new(Sign::Negative, [0, 1])
        );
        // The largest finite value: 53 ones, then 971 zeros.
        assert_eq!(
            integral(f64::MAX),
            BigInt::from((1u64 << 53) - 1).mul_bounded(BigInt::pow2(971))
        );
    }

    #[test]
    fn pow2() {
        assert_eq!(BigInt::<Naive>::pow2(0), BigInt::from(1u64));
        assert_eq!(BigInt::<Naive>::pow2(63), BigInt::from(1u64 << 63));
        assert_eq!(
            BigInt::<Naive>::pow2(64),
            BigInt::normalize_new(Sign::Positive, [0, 1])
        );
    }

    #[test]
    fn overflow_min1() {
        let x = neg(i64::MIN + 1);
        assert_eq!(x, (1 << 63) - 1);
    }
    #[test]
    fn overflow_min() {
        let x = neg(i64::MIN);
        assert_eq!(x, 1 << 63);
    }
}
