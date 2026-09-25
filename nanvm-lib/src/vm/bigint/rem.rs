use core::ops::Rem;

use crate::vm::{Any, BigInt, IVm};

impl<A: IVm> Rem for BigInt<A> {
    type Output = Result<Self, Any<A>>;

    /// The remainder of [`BigInt::div_mod`].
    fn rem(self, rhs: Self) -> Self::Output {
        self.div_mod(rhs).map(|(_, remainder)| remainder)
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
    fn sign_follows_dividend() {
        assert_eq!((int(10) % int(3)).unwrap(), int(1));
        assert_eq!((int(-10) % int(3)).unwrap(), int(-1));
        assert_eq!((int(10) % int(-3)).unwrap(), int(1));
        assert_eq!((int(-10) % int(-3)).unwrap(), int(-1));
    }

    #[test]
    fn zero_dividend() {
        assert_eq!((int(0) % int(5)).unwrap(), T::default());
    }

    #[test]
    fn exact_division_gives_zero() {
        assert_eq!((int(12) % int(4)).unwrap(), T::default());
    }

    #[test]
    fn dividend_smaller_than_divisor() {
        assert_eq!((int(3) % int(10)).unwrap(), int(3));
    }

    #[test]
    fn zero_divisor_throws() {
        assert!((int(5) % int(0)).is_err());
    }

    #[test]
    fn multi_word_remainder() {
        // 2^64 % (2^64 - 1) = 1
        let a = T::unchecked_new(Sign::Positive, [0, 1]);
        let b: T = u64::MAX.into();
        assert_eq!((a % b).unwrap(), int(1));
    }

    #[test]
    fn multi_word_dividend_single_word_divisor() {
        // (3 * 2^64 + 7) % 5 = (3*2^64 mod 5 + 7) mod 5; 2^64 mod 5 == 1, so
        // this is (3 + 7) mod 5 == 0.
        let a = T::unchecked_new(Sign::Positive, [7, 3]);
        let b: T = 5u64.into();
        assert_eq!((a % b).unwrap(), T::default());
    }
}
