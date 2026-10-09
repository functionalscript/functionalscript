use core::ops::Sub;

use crate::vm::{Any, BigInt, IVm};

/// `-`, or the `RangeError` of a difference longer than `MAX_WORDS` words, as
/// `+`, `*` and `<<` throw for a result that long.
impl<A: IVm> Sub for BigInt<A> {
    type Output = Result<Self, Any<A>>;
    fn sub(self, rhs: Self) -> Self::Output {
        let rhs_sign = rhs.sign().flip();
        self.add_signed(rhs, rhs_sign).within_limit()
    }
}

// TODO: The unit tests should not use `naive` or other VM implementations.
//       We should move these tests into integration tests.
#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        sign::Sign,
        vm::{bigint::BigInt, error},
    };

    type T = BigInt<Naive>;

    fn int(value: i64) -> T {
        value.into()
    }

    #[test]
    fn same_signs_rhs_magnitude_greater() {
        assert_eq!(int(3) - int(5), Ok(int(-2)));
        assert_eq!(int(-3) - int(-5), Ok(int(2)));
    }

    #[test]
    fn same_signs_lhs_magnitude_greater() {
        assert_eq!(int(5) - int(3), Ok(int(2)));
        assert_eq!(int(-5) - int(-3), Ok(int(-2)));
    }

    #[test]
    fn cancellation_to_zero() {
        assert_eq!(int(7) - int(7), Ok(T::default()));
        assert_eq!(int(-7) - int(-7), Ok(T::default()));
    }

    #[test]
    fn different_signs() {
        assert_eq!(int(3) - int(-5), Ok(int(8)));
        assert_eq!(int(-3) - int(5), Ok(int(-8)));
    }

    #[test]
    fn multi_word_borrow() {
        // 2^64 - 1 = u64::MAX
        let a = T::unchecked_new(Sign::Positive, [0, 1]);
        let b: T = 1u64.into();
        let expected: T = u64::MAX.into();
        assert_eq!(a - b, Ok(expected));
    }

    fn pow2(bit: i64) -> T {
        (int(1) << int(bit)).unwrap()
    }

    /// `2^1048575` is `MAX_WORDS` words; minus its negation is one word more.
    #[test]
    fn difference_at_and_past_the_limit() {
        assert_eq!(pow2(1_048_575) - int(0), Ok(pow2(1_048_575)));
        assert_eq!(
            pow2(1_048_575) - -pow2(1_048_575),
            Err(error::bigint_too_large())
        );
        assert_eq!(
            -pow2(1_048_575) - pow2(1_048_575),
            Err(error::bigint_too_large())
        );
    }
}
