use core::ops::Shr;

use crate::{
    common::{div_mod::DivMod, sized_index::SizedIndex},
    sign::Sign,
    vm::{Any, BigInt, IVm},
};

/// The result of shifting a nonzero-magnitude `self` right by a shift
/// amount that reaches or exceeds `self`'s own bit length, i.e. the entire
/// magnitude is shifted away: exactly `0` for a non-negative `self`, since
/// truncating division floors toward zero already; exactly `-1` for a
/// negative one, since flooring a negative quotient toward `-infinity`
/// never reaches `0` no matter how far right the shift goes (the same
/// reason `-1n >> 1_000_000n` is `-1n` in JS, not `0n`).
fn shifted_to_extreme<A: IVm>(sign: Sign) -> BigInt<A> {
    match sign {
        Sign::Positive => BigInt::default(),
        Sign::Negative => BigInt::unchecked_new(Sign::Negative, [1u64]),
    }
}

/// `vec += 1`, in place, propagating carry into a new word if it overflows
/// the last one. Used only to round a negative `self`'s shifted magnitude
/// up (away from zero) when a nonzero bit was shifted out from under it —
/// see [`BigInt::shr`]'s doc comment for why.
fn increment(vec: &mut Vec<u64>) {
    for word in vec.iter_mut() {
        let (sum, overflow) = word.overflowing_add(1);
        *word = sum;
        if !overflow {
            return;
        }
    }
    vec.push(1);
}

/// `>>`. <https://tc39.es/ecma262/#sec-numeric-types-bigint-signedRightShift>
///
/// Conceptually a shift over `self`'s infinite-precision two's-complement
/// bit string — equivalently, floor division by `2^rhs` — not a shift of
/// `self`'s magnitude with the sign carried along unchanged: those agree
/// for a non-negative `self` (floor division truncates toward zero there
/// anyway) but not for a negative one, where flooring rounds *away* from
/// zero whenever a nonzero bit is shifted out. `-1n >> 1n` is `-1n` (all
/// bits are `1`, so shifting right forever still reads all `1`s), not `0n`
/// the way carrying the sign over a plain magnitude shift would give.
impl<A: IVm> Shr for BigInt<A> {
    type Output = Result<Self, Any<A>>;

    fn shr(self, rhs: Self) -> Self::Output {
        // A negative shift amount is a left shift by its magnitude.
        if rhs.sign() == Sign::Negative {
            return self << -rhs;
        }

        let sign = self.sign();
        let n_len = self.length();
        if n_len == 0 {
            return Ok(self);
        }

        let shift = match rhs.length() {
            0 => return Ok(self),
            1 => rhs[0],
            // `rhs` alone (>= 2^64) already exceeds any representable
            // `self`'s bit length.
            _ => return Ok(shifted_to_extreme(sign)),
        };

        let (word_shift, bit_shift) = shift.div_mod(64);
        if word_shift >= n_len as u64 {
            return Ok(shifted_to_extreme(sign));
        }
        let word_shift = word_shift as u32;

        // Whether any bit being shifted away is set — the "was this exact"
        // check flooring a negative result needs.
        let sticky = (0..word_shift).any(|i| self[i] != 0)
            || (bit_shift > 0 && self[word_shift] & ((1u64 << bit_shift) - 1) != 0);

        let mut value: Vec<u64> = (word_shift..n_len).map(|i| self[i]).collect();
        if bit_shift > 0 {
            let mut carry = 0u64;
            for digit in value.iter_mut().rev() {
                let new_carry = *digit << (64 - bit_shift);
                *digit = (*digit >> bit_shift) | carry;
                carry = new_carry;
            }
        }

        if sign == Sign::Negative && sticky {
            increment(&mut value);
        }

        Ok(Self::normalize_new(sign, value))
    }
}

#[cfg(test)]
mod tests {
    use crate::{naive::Naive, sign::Sign, vm::bigint::BigInt};

    type T = BigInt<Naive>;

    fn pos(items: Vec<u64>) -> T {
        T::unchecked_new(Sign::Positive, items)
    }

    fn neg(items: Vec<u64>) -> T {
        T::unchecked_new(Sign::Negative, items)
    }

    #[test]
    fn zero_shr_zero() {
        let a: T = 0u64.into();
        let b: T = 0u64.into();
        assert_eq!((a >> b).unwrap(), T::default());
    }

    #[test]
    fn value_shr_zero() {
        let a: T = 42u64.into();
        let b: T = 0u64.into();
        assert_eq!((a >> b).unwrap(), 42u64.into());
    }

    #[test]
    fn zero_shr_value() {
        let a: T = 0u64.into();
        let b: T = 5u64.into();
        assert_eq!((a >> b).unwrap(), T::default());
    }

    #[test]
    fn shr_by_one() {
        let a: T = 100u64.into();
        let b: T = 1u64.into();
        assert_eq!((a >> b).unwrap(), 50u64.into());
    }

    #[test]
    fn shr_odd_number() {
        // Positive `self`: floor division truncates toward zero, same as a
        // plain magnitude shift — the lost bit is simply dropped.
        let a: T = 101u64.into();
        let b: T = 1u64.into();
        assert_eq!((a >> b).unwrap(), 50u64.into());
    }

    #[test]
    fn shr_full_word() {
        // [0, 1] represents 2^64; shifting right by 64 gives 1
        let a = pos(vec![0, 1]);
        let b: T = 64u64.into();
        assert_eq!((a >> b).unwrap(), 1u64.into());
    }

    #[test]
    fn shr_more_than_word() {
        // [0, 4] represents 4 * 2^64; shifting right by 65 gives 2
        let a = pos(vec![0, 4]);
        let b: T = 65u64.into();
        assert_eq!((a >> b).unwrap(), 2u64.into());
    }

    #[test]
    fn shr_shift_exceeds_length() {
        let a: T = 1u64.into();
        let b: T = 64u64.into();
        assert_eq!((a >> b).unwrap(), T::default());
    }

    #[test]
    fn shr_shift_exceeds_length_large() {
        let a: T = 1u64.into();
        let b: T = 128u64.into();
        assert_eq!((a >> b).unwrap(), T::default());
    }

    #[test]
    fn shr_multi_word_shift_amount() {
        // rhs with more than one word always shifts the entire magnitude
        // away; for a positive `self` that floors to zero.
        let a: T = u64::MAX.into();
        let b = pos(vec![0, 1]);
        assert_eq!((a >> b).unwrap(), T::default());
    }

    #[test]
    fn shr_multi_word_shift_amount_negative_floors_to_minus_one() {
        // Same shift-amount shape as above, but a negative `self` floors to
        // -1, not 0 — flooring a negative quotient never reaches zero.
        let a: T = (-1i64).into();
        let b = pos(vec![0, 1]);
        assert_eq!((a >> b).unwrap(), neg(vec![1]));
    }

    #[test]
    fn shr_preserves_positive_sign() {
        let a = pos(vec![200]);
        let b: T = 1u64.into();
        let result = (a >> b).unwrap();
        assert_eq!(result, 100u64.into());
    }

    #[test]
    fn shr_preserves_negative_sign() {
        // Evenly divisible: flooring and truncating agree, no rounding needed.
        let a = neg(vec![200]);
        let b: T = 1u64.into();
        assert_eq!((a >> b).unwrap(), neg(vec![100]));
    }

    #[test]
    fn shr_cross_word_boundary() {
        // [3, 1] >> 1: bit 0 of word 1 shifts into MSB of word 0
        // word 0: (3 >> 1) | (1 << 63) = 1 | 0x8000..0 = 0x8000..0001
        // word 1: 1 >> 1 = 0 (normalized away)
        let a = pos(vec![3, 1]);
        let b: T = 1u64.into();
        assert_eq!((a >> b).unwrap(), pos(vec![0x8000_0000_0000_0001]));
    }

    #[test]
    fn shr_normalizes_result() {
        // [0, 1] >> 64 = 1 (should not have trailing zero words)
        let a = pos(vec![0, 1]);
        let b: T = 64u64.into();
        let result = (a >> b).unwrap();
        assert_eq!(result, 1u64.into());
    }

    #[test]
    fn shr_large_bit_shift() {
        // 0xFF >> 4 = 0xF
        let a: T = 0xFFu64.into();
        let b: T = 4u64.into();
        assert_eq!((a >> b).unwrap(), 0xFu64.into());
    }

    #[test]
    fn shr_63_bits() {
        let a: T = (1u64 << 63).into();
        let b: T = 63u64.into();
        assert_eq!((a >> b).unwrap(), 1u64.into());
    }

    #[test]
    fn shr_three_words_by_two_words() {
        // [0, 0, 7] represents 7 * 2^128; >> 128 gives 7
        let a = pos(vec![0, 0, 7]);
        let b: T = 128u64.into();
        assert_eq!((a >> b).unwrap(), 7u64.into());
    }

    #[test]
    fn shr_three_words_by_word_plus_bits() {
        // [0, 0, 0x80] >> 65 = [0, 0x40]
        let a = pos(vec![0, 0, 0x80]);
        let b: T = 65u64.into();
        assert_eq!((a >> b).unwrap(), pos(vec![0, 0x40]));
    }

    #[test]
    fn shr_by_u64_max() {
        let a = pos(vec![u64::MAX, u64::MAX, u64::MAX]);
        let b: T = u64::MAX.into();
        assert_eq!((a >> b).unwrap(), T::default());
    }

    #[test]
    fn shr_four_words_by_192() {
        // [0, 0, 0, 5] >> 192 = 5
        let a = pos(vec![0, 0, 0, 5]);
        let b: T = 192u64.into();
        assert_eq!((a >> b).unwrap(), 5u64.into());
    }

    #[test]
    fn shr_negative_floors_instead_of_truncating_to_zero() {
        // -1n >> 64n is -1n in JS, not 0n: -1's infinite two's-complement
        // pattern is all `1`s, so shifting it right (with sign extension)
        // by any amount still reads all `1`s.
        let a = neg(vec![1]);
        let b: T = 64u64.into();
        assert_eq!((a >> b).unwrap(), neg(vec![1]));
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
        assert_eq!((a >> b).unwrap(), expected);
    }

    #[test]
    fn shr_exact_word_boundary_no_remainder() {
        // [42, 99] >> 64 = 99
        let a = pos(vec![42, 99]);
        let b: T = 64u64.into();
        assert_eq!((a >> b).unwrap(), 99u64.into());
    }

    #[test]
    fn shr_large_single_word_shift_no_truncation() {
        // shift = (u32::MAX as u64 + 1) * 64 = 274877906944
        // word_shift = 2^32 which exceeds any u32 n_len; result must be zero.
        let a = pos(vec![u64::MAX, u64::MAX]);
        let b: T = 274877906944u64.into();
        assert_eq!((a >> b).unwrap(), T::default());
    }

    #[test]
    fn shr_negative_rounds_up_on_bit_shift_remainder() {
        // neg([1]) >> 1: the single set bit is shifted away, so the
        // magnitude rounds up from 0 to 1 before negating — floor(-1/2) is
        // -1, not -0 (which BigInt doesn't have) or 0.
        let a = neg(vec![1]);
        let b: T = 1u64.into();
        assert_eq!((a >> b).unwrap(), neg(vec![1]));
    }

    #[test]
    fn shr_negative_word_shift_with_remainder_rounds_up() {
        // magnitude = 7 * 2^64 + 5; >> 64 drops the low word (5, nonzero)
        // entirely, so the remaining magnitude (7) rounds up to 8:
        // floor(-(7 * 2^64 + 5) / 2^64) = floor(-7.000...) = -8.
        let a = neg(vec![5, 7]);
        let b: T = 64u64.into();
        assert_eq!((a >> b).unwrap(), neg(vec![8]));
    }

    #[test]
    fn shr_negative_by_negative_shift_is_left_shift() {
        // x >> -y is x << y.
        let a = neg(vec![5]);
        let b: T = (-3i64).into();
        assert_eq!((a >> b).unwrap(), neg(vec![40]));
    }

    #[test]
    fn shr_by_very_negative_shift_delegates_to_too_large_shl() {
        // shift = -(2^64): `self >> shift` is `self << 2^64`, which needs
        // ~2^58 result words — well past the `too_large` guard `<<` already
        // has, reached here through `>>`'s negative-shift delegation.
        let a: T = 1u64.into();
        let b = neg(vec![0, 1]);
        assert!((a >> b).is_err());
    }
}
