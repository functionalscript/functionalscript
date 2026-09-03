use core::ops::Div;

use super::DIVISION_BY_ZERO;
use crate::{
    sign::Sign,
    vm::{Any, BigInt, IVm},
};

impl<A: IVm> Div for BigInt<A> {
    type Output = Result<Self, Any<A>>;

    /// Truncates toward zero, matching Rust's own integer division; the
    /// result is negative iff exactly one operand is.
    fn div(self, rhs: Self) -> Self::Output {
        if rhs.is_zero() {
            return Err(DIVISION_BY_ZERO.into());
        }
        let sign = if self.sign() == rhs.sign() {
            Sign::Positive
        } else {
            Sign::Negative
        };
        let (quotient, _) = self.abs_divmod_vec(rhs);
        Ok(if quotient.is_empty() {
            Self::default()
        } else {
            Self::unchecked_new(sign, quotient)
        })
    }
}

// TODO: The unit tests should not use `naive` or other VM implementations.
//       We should move these tests into integration tests.
#[cfg(test)]
mod tests {
    use crate::{naive::Naive, sign::Sign, vm::bigint::BigInt};

    type T = BigInt<Naive>;

    fn int(value: i64) -> T {
        value.into()
    }

    #[test]
    fn truncates_toward_zero() {
        assert_eq!((int(10) / int(3)).unwrap(), int(3));
        assert_eq!((int(-10) / int(3)).unwrap(), int(-3));
        assert_eq!((int(10) / int(-3)).unwrap(), int(-3));
        assert_eq!((int(-10) / int(-3)).unwrap(), int(3));
    }

    #[test]
    fn exact_division() {
        assert_eq!((int(12) / int(4)).unwrap(), int(3));
    }

    #[test]
    fn zero_dividend() {
        assert_eq!((int(0) / int(5)).unwrap(), T::default());
    }

    #[test]
    fn dividend_smaller_than_divisor_truncates_to_zero() {
        assert_eq!((int(3) / int(10)).unwrap(), T::default());
    }

    #[test]
    fn zero_divisor_throws() {
        assert!((int(5) / int(0)).is_err());
    }

    #[test]
    fn multi_word_dividend() {
        // 2^64 / 2 = 2^63
        let a = T::unchecked_new(Sign::Positive, [0, 1]);
        let b: T = 2u64.into();
        assert_eq!((a / b).unwrap(), (1u64 << 63).into());
    }

    #[test]
    fn multi_word_result() {
        // (3 * 2^64) / 3 = 2^64
        let a = T::unchecked_new(Sign::Positive, [0, 3]);
        let b: T = 3u64.into();
        assert_eq!((a / b).unwrap(), T::unchecked_new(Sign::Positive, [0, 1]));
    }
}
