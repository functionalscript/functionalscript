use core::ops::Shl;

use crate::{
    common::{div_mod::DivMod, sized_index::SizedIndex},
    sign::Sign,
    vm::{Any, BigInt, IVm},
};

const TOO_LARGE: &str = "RangeError: Maximum BigInt size exceeded";

/// The largest word count a single `<<` may grow a `BigInt` to — `2^14`
/// words (`2^20` bits, 128 KiB) — matching
/// [`fjs/types/bigint/module.f.mjs`](../../../../fjs/types/bigint/module.f.mjs)'s
/// own `maxLength` (`0x10_0000n` bits) exactly, divided down from bits to
/// 64-bit words. `maxLength` is itself the *smallest* `BigInt` size limit
/// across the engines FunctionalScript targets — V8's own limit is `2^30`
/// bits, far larger, but Bun's and Safari's are tighter, and `maxLength` is
/// already chosen to fit under all of them (see that file's own comment on
/// `mask`, keyed to the same constant). `nanvm-lib` follows the tightest
/// bound already established for the language rather than picking a
/// second, V8-only one of its own.
///
/// This is *not* the same limit as `BigInt`'s internal `u32` word index
/// (~4 billion words, ~34 GiB): that ceiling only protects the container's
/// own indexing, not the process. An allocation anywhere near it can abort
/// the process outright — `Vec`'s allocator failure is not a catchable
/// panic — from a shift count an attacker can spell in one `u64` word, well
/// before any guard based on the index limit alone would reject it. That is
/// exactly the crash-instead-of-refuse this checks against.
const MAX_WORDS: u64 = 1 << 14;

fn too_large<A: IVm>() -> Result<BigInt<A>, Any<A>> {
    Err(TOO_LARGE.into())
}

/// `<<`. <https://tc39.es/ecma262/#sec-numeric-types-bigint-leftShift>
impl<A: IVm> Shl for BigInt<A> {
    type Output = Result<Self, Any<A>>;

    fn shl(self, rhs: Self) -> Self::Output {
        // A negative shift amount is a right shift by its magnitude.
        if rhs.sign() == Sign::Negative {
            return self >> -rhs;
        }

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

        // A carry word is only produced when `bit_shift` actually pushes a
        // set bit out of the current top word — not on every shift, so this
        // is computed exactly rather than conservatively reserved for every
        // call: `1n << 1048575n` needs exactly `MAX_WORDS` words (no carry)
        // and must succeed. That boundary is `nanvm-lib`'s own `MAX_WORDS`
        // policy limit (see its doc comment), not V8's own — V8 alone would
        // still accept a shift far past it.
        let top_word = self[n_len - 1];
        let carries_new_word = bit_shift > 0 && top_word >> (64 - bit_shift) != 0;
        let result_len = word_shift + n_len as u64 + if carries_new_word { 1 } else { 0 };
        if result_len > MAX_WORDS {
            return too_large();
        }
        let word_shift = word_shift as usize;

        // `result_len` is already policy-bounded to `MAX_WORDS` (128 KiB) by
        // the check above, but the allocator can still fail below that —
        // the real memory available to an embedder can be smaller — so this
        // reserves fallibly rather than through `Vec`'s ordinary growth,
        // whose failure aborts the process instead of returning an `Err`.
        let mut value: Vec<u64> = Vec::new();
        if value.try_reserve_exact(result_len as usize).is_err() {
            return too_large();
        }
        value.extend(core::iter::repeat_n(0u64, word_shift));
        value.extend((0..n_len).map(|i| self[i]));

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

        Ok(Self::unchecked_new(self.sign(), value))
    }
}

// TODO: The unit tests should not use `naive` or other VM implementations.
//       We should move these tests into integration tests.
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
        assert_eq!((shifted >> shift).unwrap(), 42u64.into());
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
        let shifted = (a.clone() >> shift.clone()).unwrap();
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
        assert_eq!(
            a << b,
            Err("RangeError: Maximum BigInt size exceeded".into())
        );
    }

    #[test]
    fn shl_large_single_word_shift_returns_err() {
        // u64::MAX would require ~2^58 words; exceeds the MAX_WORDS limit
        let a: T = 1u64.into();
        let b: T = u64::MAX.into();
        assert_eq!(
            a << b,
            Err("RangeError: Maximum BigInt size exceeded".into())
        );
    }

    #[test]
    fn shl_just_over_max_words_returns_err_without_allocating() {
        // Shifting by exactly `MAX_WORDS * 64` bits (2^20, matching
        // `fjs/types/bigint/module.f.mjs`'s `maxLength`) needs MAX_WORDS + 1
        // words (word_shift = MAX_WORDS, plus the existing word of `1`, no
        // carry since bit_shift is 0) — one word past `nanvm-lib`'s own
        // policy limit. That is not a boundary V8 itself enforces (V8 alone
        // would still accept this shift); it is the tighter, cross-engine
        // limit this file's `MAX_WORDS` doc comment explains.
        // Rejected by the guard before any allocation is attempted, so this
        // stays cheap even though the *value* it describes would not.
        let a: T = 1u64.into();
        let b: T = (super::MAX_WORDS * 64).into();
        assert_eq!(
            a << b,
            Err("RangeError: Maximum BigInt size exceeded".into())
        );
    }

    #[test]
    fn shl_carry_word_only_counted_when_actually_needed() {
        // A shift landing the single set bit on the top word's own MSB
        // (bit_shift = 63, and that bit was 0 before the shift) produces no
        // carry — word_shift + n_len alone is the exact result length, so
        // the guard must not conservatively add one for every call. Here
        // the shift is chosen so the guard's word-count arithmetic is
        // exercised directly (word_shift = 2, matching a hypothetically
        // tiny `MAX_WORDS`), without needing an allocation anywhere near
        // the real 128 KiB limit to prove it.
        let a: T = 1u64.into();
        let b: T = 191u64.into(); // word_shift = 2, bit_shift = 63
        assert_eq!((a << b).unwrap(), pos(vec![0, 0, 1u64 << 63]));
    }

    #[test]
    fn shl_by_negative_is_right_shift() {
        // x << -y is x >> y.
        let a: T = 40u64.into();
        let b: T = (-3i64).into();
        assert_eq!((a << b).unwrap(), 5u64.into());
    }

    #[test]
    fn shl_negative_by_negative_is_right_shift() {
        let a = neg(vec![40]);
        let b: T = (-3i64).into();
        assert_eq!((a << b).unwrap(), neg(vec![5]));
    }
}
