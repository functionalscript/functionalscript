use core::ops::BitOr;

use crate::vm::{BigInt, IVm};

impl<A: IVm> BitOr for BigInt<A> {
    type Output = Self;
    fn bitor(self, rhs: Self) -> Self::Output {
        self.bitwise_op(rhs, |a, b| a | b, |a_neg, b_neg| a_neg || b_neg)
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
    fn both_positive() {
        assert_eq!(int(0b1100) | int(0b1010), int(0b1110));
    }

    #[test]
    fn both_negative() {
        // -2 | -3 == -1: 0b...110 | 0b...101 == 0b...111.
        assert_eq!(int(-2) | int(-3), int(-1));
    }

    #[test]
    fn mixed_signs() {
        // 5 | -1 == -1 (OR with all-ones is all-ones).
        assert_eq!(int(5) | int(-1), int(-1));
        assert_eq!(int(-1) | int(5), int(-1));
    }

    #[test]
    fn with_zero() {
        assert_eq!(int(0) | int(0), int(0));
        assert_eq!(int(12345) | int(0), int(12345));
        assert_eq!(int(-12345) | int(0), int(-12345));
    }

    #[test]
    fn different_word_lengths() {
        // x = -(2^64), a two-word magnitude; y = -1, a one-word magnitude
        // zero-extended to match. -1's all-ones two's-complement word ORs
        // with anything to stay all-ones, so the result is -1.
        let x = T::unchecked_new(Sign::Negative, [0u64, 1u64]);
        let y = int(-1);
        let expected = int(-1);
        assert_eq!(x | y, expected);
    }
}
