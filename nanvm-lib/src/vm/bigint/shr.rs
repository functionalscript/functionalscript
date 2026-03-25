use core::ops::Shr;

use crate::{
    common::{div_mod::DivMod, sized_index::SizedIndex},
    vm::{BigInt, IContainer, IVm},
};

use super::normalize;

impl<A: IVm> Shr for BigInt<A> {
    type Output = Self;

    fn shr(self, rhs: Self) -> Self {
        let n_len = self.length();
        if n_len == 0 {
            return self;
        }

        let shift = match rhs.length() {
            0 => return self,
            1 => rhs[0],
            _ => return Self::default(),
        };

        let (word_shift, bit_shift) = shift.div_mod(64);
        if word_shift >= n_len as u64 {
            return Self::default();
        }
        let word_shift = word_shift as u32;

        let mut value: Vec<u64> = (word_shift..n_len).map(|i| self[i]).collect();
        if bit_shift > 0 {
            let mut carry = 0u64;
            for digit in value.iter_mut().rev() {
                let new_carry = *digit << (64 - bit_shift);
                *digit = (*digit >> bit_shift) | carry;
                carry = new_carry;
            }
        }

        normalize(&mut value);
        if value.is_empty() {
            return Self::default();
        }

        Self::new(*self.0.header(), value)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        sign::Sign,
        vm::{bigint::BigInt, naive::Naive},
    };

    type T = BigInt<Naive>;

    fn pos(items: Vec<u64>) -> T {
        T::new(Sign::Positive, items)
    }

    fn neg(items: Vec<u64>) -> T {
        T::new(Sign::Negative, items)
    }

    #[test]
    fn zero_shr_zero() {
        let a: T = 0u64.into();
        let b: T = 0u64.into();
        assert_eq!(a >> b, T::default());
    }

    #[test]
    fn value_shr_zero() {
        let a: T = 42u64.into();
        let b: T = 0u64.into();
        assert_eq!(a >> b, 42u64.into());
    }

    #[test]
    fn zero_shr_value() {
        let a: T = 0u64.into();
        let b: T = 5u64.into();
        assert_eq!(a >> b, T::default());
    }

    #[test]
    fn shr_by_one() {
        let a: T = 100u64.into();
        let b: T = 1u64.into();
        assert_eq!(a >> b, 50u64.into());
    }

    #[test]
    fn shr_odd_number() {
        let a: T = 101u64.into();
        let b: T = 1u64.into();
        assert_eq!(a >> b, 50u64.into());
    }

    #[test]
    fn shr_full_word() {
        // [0, 1] represents 2^64; shifting right by 64 gives 1
        let a = pos(vec![0, 1]);
        let b: T = 64u64.into();
        assert_eq!(a >> b, 1u64.into());
    }

    #[test]
    fn shr_more_than_word() {
        // [0, 4] represents 4 * 2^64; shifting right by 65 gives 2
        let a = pos(vec![0, 4]);
        let b: T = 65u64.into();
        assert_eq!(a >> b, 2u64.into());
    }

    #[test]
    fn shr_shift_exceeds_length() {
        let a: T = 1u64.into();
        let b: T = 64u64.into();
        assert_eq!(a >> b, T::default());
    }

    #[test]
    fn shr_shift_exceeds_length_large() {
        let a: T = 1u64.into();
        let b: T = 128u64.into();
        assert_eq!(a >> b, T::default());
    }

    #[test]
    fn shr_multi_word_shift_amount() {
        // rhs with more than one word always yields zero
        let a: T = u64::MAX.into();
        let b = pos(vec![0, 1]);
        assert_eq!(a >> b, T::default());
    }

    #[test]
    fn shr_preserves_positive_sign() {
        let a = pos(vec![200]);
        let b: T = 1u64.into();
        let result = a >> b;
        assert_eq!(result, 100u64.into());
    }

    #[test]
    fn shr_preserves_negative_sign() {
        let a = neg(vec![200]);
        let b: T = 1u64.into();
        assert_eq!(a >> b, neg(vec![100]));
    }

    #[test]
    fn shr_cross_word_boundary() {
        // [3, 1] >> 1: bit 0 of word 1 shifts into MSB of word 0
        // word 0: (3 >> 1) | (1 << 63) = 1 | 0x8000..0 = 0x8000..0001
        // word 1: 1 >> 1 = 0 (normalized away)
        let a = pos(vec![3, 1]);
        let b: T = 1u64.into();
        assert_eq!(a >> b, pos(vec![0x8000_0000_0000_0001]));
    }

    #[test]
    fn shr_normalizes_result() {
        // [0, 1] >> 64 = 1 (should not have trailing zero words)
        let a = pos(vec![0, 1]);
        let b: T = 64u64.into();
        let result = a >> b;
        assert_eq!(result, 1u64.into());
    }

    #[test]
    fn shr_large_bit_shift() {
        // 0xFF >> 4 = 0xF
        let a: T = 0xFFu64.into();
        let b: T = 4u64.into();
        assert_eq!(a >> b, 0xFu64.into());
    }

    #[test]
    fn shr_63_bits() {
        let a: T = (1u64 << 63).into();
        let b: T = 63u64.into();
        assert_eq!(a >> b, 1u64.into());
    }

    #[test]
    fn shr_three_words_by_two_words() {
        // [0, 0, 7] represents 7 * 2^128; >> 128 gives 7
        let a = pos(vec![0, 0, 7]);
        let b: T = 128u64.into();
        assert_eq!(a >> b, 7u64.into());
    }

    #[test]
    fn shr_three_words_by_word_plus_bits() {
        // [0, 0, 0x80] >> 65 = [0, 0x40]
        let a = pos(vec![0, 0, 0x80]);
        let b: T = 65u64.into();
        assert_eq!(a >> b, pos(vec![0, 0x40]));
    }

    #[test]
    fn shr_by_u64_max() {
        let a = pos(vec![u64::MAX, u64::MAX, u64::MAX]);
        let b: T = u64::MAX.into();
        assert_eq!(a >> b, T::default());
    }

    #[test]
    fn shr_four_words_by_192() {
        // [0, 0, 0, 5] >> 192 = 5
        let a = pos(vec![0, 0, 0, 5]);
        let b: T = 192u64.into();
        assert_eq!(a >> b, 5u64.into());
    }

    #[test]
    fn shr_negative_to_zero() {
        let a = neg(vec![1]);
        let b: T = 64u64.into();
        assert_eq!(a >> b, T::default());
    }

    #[test]
    fn shr_multi_word_carry_propagation() {
        // [0, 0, 3] >> 1
        // carry starts at 0.
        // word 2: 3 >> 1 = 1, carry = (3 << 63) as u64 = 0x8000_0000_0000_0000
        // word 1: (0 >> 1) | 0x8000_0000_0000_0000, carry = 0
        // word 0: (0 >> 1) | 0 = 0
        let a = pos(vec![0, 0, 3]);
        let b: T = 1u64.into();
        let expected = pos(vec![0, 0x8000_0000_0000_0000, 1]);
        assert_eq!(a >> b, expected);
    }

    #[test]
    fn shr_exact_word_boundary_no_remainder() {
        // [42, 99] >> 64 = 99
        let a = pos(vec![42, 99]);
        let b: T = 64u64.into();
        assert_eq!(a >> b, 99u64.into());
    }

    #[test]
    fn shr_large_single_word_shift_no_truncation() {
        // shift = (u32::MAX as u64 + 1) * 64 = 274877906944
        // word_shift = 2^32 which exceeds any u32 n_len; result must be zero.
        let a = pos(vec![u64::MAX, u64::MAX]);
        let b: T = 274877906944u64.into();
        assert_eq!(a >> b, T::default());
    }

    #[test]
    fn shr_negative_to_zero_by_bit_shift() {
        // neg([1]) >> 1: result is 0, must be default (positive zero), not negative zero
        let a = neg(vec![1]);
        let b: T = 1u64.into();
        assert_eq!(a >> b, T::default());
    }
}
