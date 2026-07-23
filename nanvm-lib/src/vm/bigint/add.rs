use core::ops::Add;

use crate::vm::{BigInt, IContainer, IVm};

impl<A: IVm> Add for BigInt<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        let rhs_sign = *rhs.0.header();
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
    fn same_signs() {
        assert_eq!(int(3) + int(5), int(8));
        assert_eq!(int(-3) + int(-5), int(-8));
    }

    #[test]
    fn different_signs_rhs_magnitude_greater() {
        assert_eq!(int(3) + int(-5), int(-2));
        assert_eq!(int(-3) + int(5), int(2));
    }

    #[test]
    fn different_signs_lhs_magnitude_greater() {
        assert_eq!(int(5) + int(-3), int(2));
        assert_eq!(int(-5) + int(3), int(-2));
    }

    #[test]
    fn cancellation_to_zero() {
        assert_eq!(int(7) + int(-7), T::default());
        assert_eq!(int(-7) + int(7), T::default());
    }

    #[test]
    fn multi_word_carry() {
        let a: T = u64::MAX.into();
        let b: T = 1u64.into();
        assert_eq!(a + b, T::unchecked_new(Sign::Positive, [0, 1]));
    }
}
