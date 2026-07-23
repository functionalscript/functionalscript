use core::ops::Sub;

use crate::vm::{BigInt, IContainer, IVm};

impl<A: IVm> Sub for BigInt<A> {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self::Output {
        let rhs_sign = rhs.0.header().flip();
        self.add_signed(rhs, rhs_sign)
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
    fn same_signs_rhs_magnitude_greater() {
        assert_eq!(int(3) - int(5), int(-2));
        assert_eq!(int(-3) - int(-5), int(2));
    }

    #[test]
    fn same_signs_lhs_magnitude_greater() {
        assert_eq!(int(5) - int(3), int(2));
        assert_eq!(int(-5) - int(-3), int(-2));
    }

    #[test]
    fn cancellation_to_zero() {
        assert_eq!(int(7) - int(7), T::default());
        assert_eq!(int(-7) - int(-7), T::default());
    }

    #[test]
    fn different_signs() {
        assert_eq!(int(3) - int(-5), int(8));
        assert_eq!(int(-3) - int(5), int(-8));
    }

    #[test]
    fn multi_word_borrow() {
        // 2^64 - 1 = u64::MAX
        let a = T::unchecked_new(Sign::Positive, [0, 1]);
        let b: T = 1u64.into();
        let expected: T = u64::MAX.into();
        assert_eq!(a - b, expected);
    }
}
