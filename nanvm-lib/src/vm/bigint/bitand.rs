use core::ops::BitAnd;

use crate::vm::{BigInt, IVm};

impl<A: IVm> BitAnd for BigInt<A> {
    type Output = Self;
    fn bitand(self, rhs: Self) -> Self::Output {
        self.bitwise_op(rhs, |a, b| a & b, |a_neg, b_neg| a_neg && b_neg)
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
        assert_eq!(int(0b1100) & int(0b1010), int(0b1000));
    }

    #[test]
    fn both_negative() {
        // -1 & -1 == -1 (all-ones AND all-ones).
        assert_eq!(int(-1) & int(-1), int(-1));
        // -2 & -3 == -4: 0b...110 & 0b...101 == 0b...100.
        assert_eq!(int(-2) & int(-3), int(-4));
    }

    #[test]
    fn mixed_signs() {
        // 5 & -1 == 5 (AND with all-ones is identity).
        assert_eq!(int(5) & int(-1), int(5));
        // -1 & 5 == 5.
        assert_eq!(int(-1) & int(5), int(5));
    }

    #[test]
    fn with_zero() {
        assert_eq!(int(0) & int(0), int(0));
        assert_eq!(int(12345) & int(0), int(0));
        assert_eq!(int(-12345) & int(0), int(0));
    }

    #[test]
    fn multi_word_carry_on_decode() {
        // x = -(0xFFFFFFFF00000001), y = -(0x100000000). Both single-word
        // magnitudes, so L=1: x's two's-complement word is 0x00000000FFFFFFFF
        // and y's is 0xFFFFFFFF00000000, which AND to all-zero across that
        // single word — so decoding the negative result must carry a
        // brand-new second word into existence, giving -(2^64).
        let x = T::unchecked_new(Sign::Negative, [0xFFFF_FFFF_0000_0001u64]);
        let y = T::unchecked_new(Sign::Negative, [0x1_0000_0000u64]);
        let expected = T::unchecked_new(Sign::Negative, [0u64, 1u64]);
        assert_eq!(x & y, expected);
    }
}
