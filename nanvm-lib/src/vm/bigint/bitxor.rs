use core::ops::BitXor;

use crate::vm::{BigInt, IVm};

impl<A: IVm> BitXor for BigInt<A> {
    type Output = Self;
    fn bitxor(self, rhs: Self) -> Self::Output {
        self.bitwise_op(rhs, |a, b| a ^ b, |a_neg, b_neg| a_neg != b_neg)
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
        assert_eq!(int(0b1100) ^ int(0b1010), int(0b0110));
    }

    #[test]
    fn both_negative() {
        // -1 ^ -1 == 0 (all-ones XOR all-ones cancels out).
        assert_eq!(int(-1) ^ int(-1), int(0));
        // -2 ^ -3 == 3: 0b...110 ^ 0b...101 == 0b...011.
        assert_eq!(int(-2) ^ int(-3), int(3));
    }

    #[test]
    fn mixed_signs() {
        // 5 ^ -1 == -6 (XOR with all-ones flips every bit, i.e. bitwise NOT).
        assert_eq!(int(5) ^ int(-1), int(-6));
        assert_eq!(int(-1) ^ int(5), int(-6));
    }

    #[test]
    fn with_zero() {
        assert_eq!(int(0) ^ int(0), int(0));
        assert_eq!(int(12345) ^ int(0), int(12345));
        assert_eq!(int(-12345) ^ int(0), int(-12345));
    }

    #[test]
    fn multi_word_carry_on_decode() {
        // x = -(0xFFFFFFFF00000001), whose two's-complement word is
        // 0x00000000FFFFFFFF; y = 0x00000000FFFFFFFF (positive, so its
        // pattern is its own value). XORing equal words gives an all-zero
        // pattern, so decoding the negative result must carry a brand-new
        // second word into existence, giving -(2^64).
        let x = T::unchecked_new(Sign::Negative, [0xFFFF_FFFF_0000_0001u64]);
        let y = T::unchecked_new(Sign::Positive, [0x0000_0000_FFFF_FFFFu64]);
        let expected = T::unchecked_new(Sign::Negative, [0u64, 1u64]);
        assert_eq!(x ^ y, expected);
    }
}
