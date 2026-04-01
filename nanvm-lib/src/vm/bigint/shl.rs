use core::ops::Shl;

use crate::{
    common::{div_mod::DivMod, sized_index::SizedIndex},
    vm::{Any, BigInt, IContainer, IVm},
};

const TOO_LARGE: &str = "shl: shift amount too large";

fn too_large<A: IVm>() -> Result<BigInt<A>, Any<A>> {
    Err(TOO_LARGE.into())
}

impl<A: IVm> Shl for BigInt<A> {
    type Output = Result<Self, Any<A>>;

    // TODO: handle negative shift amounts (right shift)
    fn shl(self, rhs: Self) -> Self::Output {
        let n_len = self.length();
        if n_len == 0 {
            return Ok(self);
        }

        let shift = match rhs.length() {
            0 => return Ok(self),
            1 => rhs[0],
            _ => return too_large(),
        };

        let (word_shift, bit_shift) = shift.div_mod(64);

        // Result can have at most word_shift + n_len + 1 words (carry).
        // BigInt uses u32 indexing, so the result must fit in u32::MAX words.
        if word_shift + n_len as u64 + 1 > u32::MAX as u64 {
            return too_large();
        }
        let word_shift = word_shift as usize;

        // TODO: implement as an iterator without additional allocations.
        let mut value: Vec<u64> = core::iter::repeat_n(0u64, word_shift)
            .chain((0..n_len).map(|i| self[i]))
            .collect();

        if bit_shift > 0 {
            let mut carry = 0u64;
            for digit in value.iter_mut().skip(word_shift) {
                let new_carry = *digit >> (64 - bit_shift);
                *digit = (*digit << bit_shift) | carry;
                carry = new_carry;
            }
            if carry != 0 {
                value.push(carry);
            }
        }

        assert!(
            value.last() != Some(&0) && !value.is_empty(),
            "shl: result must be normalized and non-empty"
        );

        Ok(Self::new(*self.0.header(), value))
    }
}

// TODO: The unit tests should not use `naive` or other VM implementations.
//       We should move these tests into integration tests.
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
    fn zero_shl_zero() {
        let a: T = 0u64.into();
        let b: T = 0u64.into();
        assert_eq!((a << b).unwrap(), T::default());
    }

    #[test]
    fn value_shl_zero() {
        let a: T = 42u64.into();
        let b: T = 0u64.into();
        assert_eq!((a << b).unwrap(), 42u64.into());
    }

    #[test]
    fn zero_shl_value() {
        let a: T = 0u64.into();
        let b: T = 5u64.into();
        assert_eq!((a << b).unwrap(), T::default());
    }

    #[test]
    fn shl_by_one() {
        let a: T = 50u64.into();
        let b: T = 1u64.into();
        assert_eq!((a << b).unwrap(), 100u64.into());
    }

    #[test]
    fn shl_full_word() {
        // 1 << 64 = [0, 1]
        let a: T = 1u64.into();
        let b: T = 64u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 1]));
    }

    #[test]
    fn shl_more_than_word() {
        // 2 << 65 = 4 * 2^64 = [0, 4]
        let a: T = 2u64.into();
        let b: T = 65u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 4]));
    }

    #[test]
    fn shl_preserves_positive_sign() {
        let a = pos(vec![100]);
        let b: T = 1u64.into();
        assert_eq!((a << b).unwrap(), 200u64.into());
    }

    #[test]
    fn shl_preserves_negative_sign() {
        let a = neg(vec![100]);
        let b: T = 1u64.into();
        assert_eq!((a << b).unwrap(), neg(vec![200]));
    }

    #[test]
    fn shl_63_bits() {
        let a: T = 1u64.into();
        let b: T = 63u64.into();
        assert_eq!((a << b).unwrap(), (1u64 << 63).into());
    }

    #[test]
    fn shl_overflow_into_new_word() {
        // 0x8000_0000_0000_0000 << 1 = 2^64 = [0, 1]
        let a: T = (1u64 << 63).into();
        let b: T = 1u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 1]));
    }

    #[test]
    fn shl_large_bit_shift() {
        // 0xF << 4 = 0xF0
        let a: T = 0xFu64.into();
        let b: T = 4u64.into();
        assert_eq!((a << b).unwrap(), 0xF0u64.into());
    }

    #[test]
    fn shl_three_words_by_word() {
        // [1, 2, 3] << 64 = [0, 1, 2, 3]
        let a = pos(vec![1, 2, 3]);
        let b: T = 64u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 1, 2, 3]));
    }

    #[test]
    fn shl_three_words_by_128() {
        // [1, 2, 3] << 128 = [0, 0, 1, 2, 3]
        let a = pos(vec![1, 2, 3]);
        let b: T = 128u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 0, 1, 2, 3]));
    }

    #[test]
    fn shl_word_plus_bits() {
        // [0x80] << 65 = shift by 64 words + 1 bit
        // = [0, 0x100]
        let a = pos(vec![0x80]);
        let b: T = 65u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 0x100]));
    }

    #[test]
    fn shl_multi_word_carry_propagation() {
        // [u64::MAX, u64::MAX] << 1
        // word 0: (MAX << 1) | 0 = MAX - 1 + carry 1
        // word 1: (MAX << 1) | 1 = MAX, carry 1
        // overflow carry: 1
        let a = pos(vec![u64::MAX, u64::MAX]);
        let b: T = 1u64.into();
        let expected = pos(vec![u64::MAX - 1, u64::MAX, 1]);
        assert_eq!((a << b).unwrap(), expected);
    }

    #[test]
    fn shl_roundtrip_with_shr() {
        // (42 << 10) >> 10 = 42
        let a: T = 42u64.into();
        let shift: T = 10u64.into();
        let shifted = (a.clone() << shift.clone()).unwrap();
        assert_eq!(shifted >> shift, 42u64.into());
    }

    #[test]
    fn shl_negative_to_multi_word() {
        let a = neg(vec![1]);
        let b: T = 64u64.into();
        assert_eq!((a << b).unwrap(), neg(vec![0, 1]));
    }

    #[test]
    fn shl_by_192() {
        // 5 << 192 = [0, 0, 0, 5]
        let a: T = 5u64.into();
        let b: T = 192u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 0, 0, 5]));
    }

    #[test]
    fn shl_by_63_multi_word() {
        // [1, 1] << 63: maximum bit_shift on multi-word input
        // word 0: (1 << 63) | 0 = 0x8000_0000_0000_0000, carry = 0
        // word 1: (1 << 63) | 0 = 0x8000_0000_0000_0000, carry = 0
        let a = pos(vec![1, 1]);
        let b: T = 63u64.into();
        assert_eq!(
            (a << b).unwrap(),
            pos(vec![0x8000_0000_0000_0000, 0x8000_0000_0000_0000])
        );
    }

    #[test]
    fn shl_all_ones_by_63() {
        // [u64::MAX] << 63: all bits carry over
        // digit: (MAX << 63) = 0x8000_0000_0000_0000, carry = MAX >> 1 = 0x7FFF_FFFF_FFFF_FFFF
        let a: T = u64::MAX.into();
        let b: T = 63u64.into();
        assert_eq!(
            (a << b).unwrap(),
            pos(vec![0x8000_0000_0000_0000, 0x7FFF_FFFF_FFFF_FFFF])
        );
    }

    #[test]
    fn shl_pure_word_shift_multi_word() {
        // [7, 11, 13] << 128: only word shift, no bit shift
        let a = pos(vec![7, 11, 13]);
        let b: T = 128u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 0, 7, 11, 13]));
    }

    #[test]
    fn shl_u64_max_by_one() {
        // u64::MAX << 1 = [u64::MAX - 1, 1]
        let a: T = u64::MAX.into();
        let b: T = 1u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![u64::MAX - 1, 1]));
    }

    #[test]
    fn shr_then_shl_roundtrip() {
        // ([0, 42] >> 10) << 10 should equal [0, 42] (no bits lost in low word)
        let a = pos(vec![0, 42]);
        let shift: T = 10u64.into();
        let shifted = a.clone() >> shift.clone();
        assert_eq!((shifted << shift).unwrap(), pos(vec![0, 42]));
    }

    #[test]
    fn shl_negative_multi_word_with_carry() {
        // neg([u64::MAX, u64::MAX]) << 1: carry propagates and overflows
        let a = neg(vec![u64::MAX, u64::MAX]);
        let b: T = 1u64.into();
        assert_eq!((a << b).unwrap(), neg(vec![u64::MAX - 1, u64::MAX, 1]));
    }

    #[test]
    fn shl_negative_multi_word_word_plus_bits() {
        // neg([1, 2]) << 65: word_shift=1, bit_shift=1
        // after word shift: [0, 1, 2]
        // bit shift: word1: (1<<1)|0 = 2, carry=0; word2: (2<<1)|0 = 4, carry=0
        let a = neg(vec![1, 2]);
        let b: T = 65u64.into();
        assert_eq!((a << b).unwrap(), neg(vec![0, 2, 4]));
    }

    #[test]
    fn shl_multi_word_word_plus_bits() {
        // [3, 5] << 65: word_shift=1, bit_shift=1
        // after word shift: [0, 3, 5]
        // bit shift: word1: (3<<1)|0 = 6, carry=0; word2: (5<<1)|0 = 10, carry=0
        let a = pos(vec![3, 5]);
        let b: T = 65u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 6, 10]));
    }

    #[test]
    fn shl_word_plus_bits_with_carry_overflow() {
        // [0x8000_0000_0000_0000] << 65: word_shift=1, bit_shift=1
        // after word shift: [0, 0x8000_0000_0000_0000]
        // bit shift: (0x8000.. << 1) | 0 = 0, carry = 1 → pushed as new word
        let a = pos(vec![0x8000_0000_0000_0000]);
        let b: T = 65u64.into();
        assert_eq!((a << b).unwrap(), pos(vec![0, 0, 1]));
    }

    #[test]
    fn shl_all_ones_multi_word_by_63() {
        // [u64::MAX, u64::MAX] << 63: max carry propagation across words
        // word 0: (MAX << 63) | 0 = 0x8000.., carry = MAX >> 1 = 0x7FFF..
        // word 1: (MAX << 63) | 0x7FFF.. = 0xFFFF.., carry = MAX >> 1 = 0x7FFF..
        // overflow carry: 0x7FFF.. pushed
        let a = pos(vec![u64::MAX, u64::MAX]);
        let b: T = 63u64.into();
        assert_eq!(
            (a << b).unwrap(),
            pos(vec![0x8000_0000_0000_0000, u64::MAX, 0x7FFF_FFFF_FFFF_FFFF])
        );
    }

    #[test]
    fn shl_multi_word_rhs_returns_err() {
        let a: T = 1u64.into();
        let b = pos(vec![0, 1]); // shift = 2^64
        assert_eq!(a << b, Err("shl: shift amount too large".into()));
    }

    #[test]
    fn shl_large_single_word_shift_returns_err() {
        // u64::MAX would require ~2^58 words; exceeds u32::MAX limit
        let a: T = 1u64.into();
        let b: T = u64::MAX.into();
        assert_eq!(a << b, Err("shl: shift amount too large".into()));
    }
}
