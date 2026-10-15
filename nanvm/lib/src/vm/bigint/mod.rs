mod add;
mod bitand;
mod bitor;
mod bitxor;
mod cmp;
mod debug;
mod default;
mod display;
mod div;
mod from;
mod index;
mod mul;
mod neg;
mod partial_eq;
mod pow;
mod radix;
mod rem;
mod shl;
mod shr;
mod sub;
#[cfg(test)]
mod test_util;
mod to_f64;

use core::{cmp::Ordering, iter::once};

use crate::{
    common::{div_mod::DivMod, iter::Iter, sized_index::SizedIndex, uint::Uint},
    sign::Sign,
    vm::{Any, IContainer, IVm, error},
};

/// The largest word count a `<<` or a `*` may grow a `BigInt` to — `2^14`
/// words (`2^20` bits, 128 KiB) — matching
/// [`fjs/types/bigint/module.f.mjs`](../../../../../fjs/types/bigint/module.f.mjs)'s
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
/// panic — from a shift count an attacker can spell in one `u64` word, or from
/// operands whose product is that long, well before any guard based on the
/// index limit alone would reject it. That is
/// exactly the crash-instead-of-refuse this checks against.
const MAX_WORDS: u64 = 1 << 14;

/// [`BigInt::abs_sub_vec`]'s precondition, broken.
const RHS_GREATER: &str = "abs_sub_vec: rhs is greater than self";

/// A non-negative shift amount, decoded once for `<<` (`shl.rs`) and `>>`
/// (`shr.rs`) by [`BigInt::shift_amount`]. Each operation picks its own
/// result for the two degenerate cases; only `Words` reaches a shift loop.
enum ShiftAmount {
    /// `self` is `0n`, or the amount is `0n`: the result is `self`.
    Noop,
    /// The amount does not fit one word (`>= 2^64`).
    TooWide,
    /// The amount as whole words and the bits left over (`< 64`).
    Words(u64, u64),
}

// The word layer: magnitude arithmetic over plain little-endian words (least
// significant first). It is the single owner of these algorithms; the
// `BigInt`-level methods below only convert their operands and delegate, so
// [`abs_divmod_vec`](BigInt::abs_divmod_vec) can run its inner loop on words
// without rebuilding a `BigInt` on every bit.

/// Drops `words`' leading (most-significant) zero words, so a magnitude is
/// normalized: zero becomes empty.
fn trim(words: &mut Vec<u64>) {
    while words.last() == Some(&0) {
        words.pop();
    }
}

/// Compares two magnitudes with no leading (most-significant) zero words: the
/// longer one (more significant words) is greater; at equal length, the first
/// differing word from the most-significant end decides.
fn cmp_words<T: SizedIndex<usize, Output = u64> + ?Sized>(a: &T, b: &T) -> Ordering {
    a.length().cmp(&b.length()).then_with(|| {
        let words = (0..a.length()).rev();
        words.clone().map(|i| a[i]).cmp(words.map(|i| b[i]))
    })
}

/// `a -= b` word by word, in place, with `b` read as zero past its end: the
/// one borrow loop behind both [`sub_words_assign`] and
/// [`abs_sub_vec`](BigInt::abs_sub_vec). Returns the borrow out of `a`'s most
/// significant word: `true` iff `b > a` (when `b` is no longer than `a`), in
/// which case `a` holds the difference wrapped modulo `2^(64 * a.len())`.
/// Words of `b` beyond `a`'s length are not read, so the caller rules out a
/// longer `b` itself.
fn sub_words_borrow(a: &mut [u64], b: impl IntoIterator<Item = u64>) -> bool {
    let mut b = b.into_iter();
    let mut borrow = false;
    for word in a.iter_mut() {
        let (diff, under_b) = word.overflowing_sub(b.next().unwrap_or(0));
        let (diff, under_borrow) = diff.overflowing_sub(borrow as u64);
        *word = diff;
        borrow = under_b || under_borrow;
    }
    borrow
}

/// `a -= b`, in place, trimming any leading zero words the subtraction
/// produces so `a` stays normalized.
///
/// Precondition: `cmp_words(a, b)` is not `Ordering::Less`.
fn sub_words_assign(a: &mut Vec<u64>, b: &[u64]) {
    sub_words_borrow(a, b.iter().copied());
    trim(a);
}

/// `words += 1`, in place: the carry ripples up until a word does not
/// overflow, and becomes a new most-significant word if every word did.
fn add_one(words: &mut Vec<u64>) {
    for word in words.iter_mut() {
        let (sum, overflow) = word.overflowing_add(1);
        *word = sum;
        if !overflow {
            return;
        }
    }
    words.push(1);
}

/// `words -= 1`, in place: the borrow ripples up until a word does not
/// underflow. The length never changes, and no trim is made; an all-zero
/// `words` wraps to all ones (callers pass a nonzero magnitude).
fn sub_one(words: &mut [u64]) {
    for word in words.iter_mut() {
        let (diff, underflow) = word.overflowing_sub(1);
        *word = diff;
        if !underflow {
            return;
        }
    }
}

/// The positive magnitude a negative `bitwise_op` result's two's-complement
/// word pattern decodes to: flip every bit, then add one — the standard
/// two's-complement negation, over words instead of a single machine
/// integer. The `+ 1` can carry a new word into existence (`!x` all-ones
/// becomes all-zeros, and `+ 1` then carries out past the last word), which
/// [`add_one`] does.
fn magnitude_from_twos_complement(mut words: Vec<u64>) -> Vec<u64> {
    for word in words.iter_mut() {
        *word = !*word;
    }
    add_one(&mut words);
    trim(&mut words);
    words
}

/// ```
/// use nanvm_lib::{vm::{BigInt, IVm}, naive::Naive};
/// fn bigint_test<A: IVm>() {
///     let a: BigInt<A> = 12345678901234567890u64.into();
///     let b: BigInt<A> = (-1234567890123456789i64).into();
/// }
///
/// bigint_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct BigInt<A: IVm>(A::InternalBigInt);

impl<A: IVm> BigInt<A> {
    /// `self`, or the `RangeError` of a `BigInt` longer than `MAX_WORDS`
    /// words: the check `+`, `-` and `*` make of their results (`<<` checks
    /// its width before it allocates).
    pub(crate) fn within_limit(self) -> Result<Self, Any<A>> {
        if u64::from(self.length()) > MAX_WORDS {
            return Err(error::bigint_too_large());
        }
        Ok(self)
    }

    /// `self * rhs` where the caller's operands are bounded by construction
    /// to a product far under `MAX_WORDS`, as the exact arithmetic of a
    /// `binary64` is (a 53-bit mantissa, a power of two, a power of ten of at
    /// most a few hundred digits): the product cannot throw.
    pub(crate) fn mul_bounded(self, rhs: Self) -> Self {
        (self * rhs).expect("a binary64's exact arithmetic is far under BigInt's size limit")
    }

    /// `self + rhs` where the caller's operands are bounded by construction,
    /// as for `mul_bounded`: the sum cannot throw.
    pub(crate) fn add_bounded(self, rhs: Self) -> Self {
        (self + rhs).expect("a binary64's exact arithmetic is far under BigInt's size limit")
    }

    /// `pub(crate)`, not private: `BooleanCoercion` (`vm/boolean_coercion.rs`)
    /// uses this to test `0n` without constructing and comparing against a
    /// throwaway `BigInt::default()`.
    pub(crate) fn is_zero(&self) -> bool {
        self.0.items().is_empty()
    }

    fn sign(&self) -> Sign {
        *self.0.header()
    }

    /// The function doesn't normalize the bigint.
    fn unchecked_new(sign: Sign, items: impl IntoIterator<Item = u64>) -> Self {
        Self(A::InternalBigInt::new_ok(sign, items))
    }

    /// Note: this function accepts an iterator in least-significant-word-first order,
    /// i.e. the first item is the least significant word!
    pub fn normalize_new(sign: Sign, items: impl IntoIterator<Item = u64>) -> Self {
        let mut vec: Vec<u64> = items.into_iter().collect();
        // TODO: Don't allocate vector for the normalization.
        trim(&mut vec);
        if vec.is_empty() {
            Self::default()
        } else {
            Self::unchecked_new(sign, vec)
        }
    }

    /// Decodes `rhs`, a non-negative shift amount, against `self`.
    fn shift_amount(&self, rhs: &Self) -> ShiftAmount {
        if self.length() == 0 {
            return ShiftAmount::Noop;
        }
        match rhs.length() {
            0 => ShiftAmount::Noop,
            1 => {
                let (word_shift, bit_shift) = rhs[0].div_mod(64);
                ShiftAmount::Words(word_shift, bit_shift)
            }
            _ => ShiftAmount::TooWide,
        }
    }

    fn new_one(sign: Sign, value: u64) -> Self {
        Self::unchecked_new(sign, once(value))
    }

    /// `self + (rhs with its sign replaced by rhs_sign)`.
    ///
    /// The single signed dispatch shared by `Add` and `Sub` (`a - b = a + (-b)`).
    /// The effective sign is threaded as a parameter instead of negating `rhs`
    /// via `Neg`, because `Neg` rebuilds the container (copying every word) —
    /// don't "simplify" `sub` back to `self + (-rhs)`.
    fn add_signed(self, rhs: Self, rhs_sign: Sign) -> Self {
        let lhs_sign = self.sign();
        let (sign, vec) = if lhs_sign == rhs_sign {
            (lhs_sign, self.abs_add_vec(rhs))
        } else {
            // Signs differ: the result takes the sign of the larger magnitude.
            match self.clone().abs_cmp_vec(rhs.clone()) {
                Ordering::Equal => return Self::default(),
                Ordering::Greater => (lhs_sign, self.abs_sub_vec(rhs)),
                Ordering::Less => (rhs_sign, rhs.abs_sub_vec(self)),
            }
        };
        Self::unchecked_new(sign, vec)
    }

    /// Truncating division: `(self / rhs, self % rhs)`.
    ///
    /// The single owner of the protocol `Div` and `Rem` project from: the
    /// zero-divisor guard, the magnitude division, and both sign rules. The
    /// quotient truncates toward zero, so it is negative iff exactly one
    /// operand is; the remainder's sign follows the dividend. Both match
    /// Rust's own integer `/` and `%`. Only the zero divisor is special: JS
    /// throws instead of the `NaN` a `Number` operation would give.
    pub fn div_mod(self, rhs: Self) -> Result<(Self, Self), Any<A>> {
        if rhs.is_zero() {
            return Err(error::division_by_zero());
        }
        let lhs_sign = self.sign();
        let quotient_sign = lhs_sign * rhs.sign();
        let (quotient, remainder) = self.abs_divmod_vec(rhs);
        Ok((
            Self::normalize_new(quotient_sign, quotient),
            Self::normalize_new(lhs_sign, remainder),
        ))
    }

    fn add_to_vec(mut vec: Vec<u64>, index: u32, add: u128) -> Vec<u64> {
        // TODO: replace recursion with loop.
        let sum = vec[index as usize] as u128 + add;
        vec[index as usize] = sum as u64;
        let carry = sum >> 64;
        if carry > 0 {
            vec = Self::add_to_vec(vec, index + 1, carry);
        }
        vec
    }

    /// Panics if this BigInt is not normalized, i.e. if it has leading
    /// (most-significant) zero words.
    fn assert_normalized(&self) {
        assert_slice_normalized(self.0.items());
    }

    /// Panics unless both `self` and `rhs` are normalized: the shared
    /// precondition of the two-operand magnitude helpers.
    fn assert_normalized_with(&self, rhs: &Self) {
        self.assert_normalized();
        rhs.assert_normalized();
    }

    /// Compare absolute values by looking at the most-significant words first.
    ///
    /// Precondition: both `self` and `rhs` must be normalized, i.e. they must
    /// not contain leading (most-significant) zero words.
    fn abs_cmp_vec(self, rhs: Self) -> Ordering {
        self.assert_normalized_with(&rhs);
        cmp_words(self.0.items(), rhs.0.items())
    }

    fn abs_add_vec(self, rhs: Self) -> Vec<u64> {
        self.assert_normalized_with(&rhs);

        let mut carry: u128 = 0;
        let mut out: Vec<u64> = self
            .index_iter()
            .zip_longest(rhs.index_iter())
            .map(|(a, b)| {
                let sum = a.unwrap_or_default() as u128 + b.unwrap_or_default() as u128 + carry;
                carry = sum >> 64;
                sum as u64
            })
            .collect();

        if carry > 0 {
            out.push(carry as u64);
        }

        // Postcondition: result must be normalized.
        assert_slice_normalized(out.as_slice());
        out
    }

    /// `|self| - |rhs|`, normalized.
    ///
    /// Precondition: both operands are normalized, and `|rhs| <= |self|`;
    /// panics with [`RHS_GREATER`] otherwise.
    fn abs_sub_vec(self, rhs: Self) -> Vec<u64> {
        self.assert_normalized_with(&rhs);

        // Normalized, a longer `rhs` is a greater one; `sub_words_borrow`
        // would not read its extra words.
        if rhs.length() > self.length() {
            panic!("{RHS_GREATER}");
        }
        let mut out: Vec<u64> = self.index_iter().collect();
        if sub_words_borrow(&mut out, rhs.index_iter()) {
            panic!("{RHS_GREATER}");
        }
        trim(&mut out);
        out
    }

    /// `(|self| / |rhs|, |self| % |rhs|)`, via schoolbook binary long
    /// division: one bit of the dividend at a time, shifted into a running
    /// remainder that is reduced by the divisor whenever it grows large
    /// enough, recording a quotient bit each time it is.
    ///
    /// Precondition: both operands are normalized, and `rhs` is non-zero.
    fn abs_divmod_vec(self, rhs: Self) -> (Vec<u64>, Vec<u64>) {
        self.assert_normalized_with(&rhs);

        let denom: Vec<u64> = rhs.index_iter().collect();
        let numer: Vec<u64> = self.index_iter().collect();

        let mut quotient: Vec<u64> = vec![0; numer.len()];
        let mut remainder: Vec<u64> = Vec::new();
        for bit in (0..numer.len() as u32 * 64).rev() {
            let numer_bit = (numer[(bit / 64) as usize] >> (bit % 64)) & 1;

            let mut carry = numer_bit;
            for word in remainder.iter_mut() {
                let next_carry = *word >> 63;
                *word = (*word << 1) | carry;
                carry = next_carry;
            }
            if carry != 0 {
                remainder.push(carry);
            }

            if cmp_words(remainder.as_slice(), denom.as_slice()) != Ordering::Less {
                sub_words_assign(&mut remainder, &denom);
                quotient[(bit / 64) as usize] |= 1u64 << (bit % 64);
            }
        }

        trim(&mut quotient);
        (quotient, remainder)
    }

    /// This BigInt's infinite-precision two's-complement bit pattern, sliced
    /// to `len` words (the caller passes the larger of the two operand
    /// lengths, so no significant bit is cut off). Non-negative: the
    /// magnitude, zero-padded. Negative: `NOT(|self| - 1)` — the standard
    /// two's-complement encoding, chosen (over flip-then-subtract) because
    /// the sign bit implicitly repeats forever above the magnitude, and
    /// subtracting first keeps that repetition free instead of needing it
    /// threaded through the padding words too.
    fn twos_complement_words(self, len: u32) -> Vec<u64> {
        let sign = self.sign();
        let mut words: Vec<u64> = self.index_iter().collect();
        words.resize(len as usize, 0);
        if sign == Sign::Negative {
            sub_one(&mut words);
            for word in words.iter_mut() {
                *word = !*word;
            }
        }
        words
    }

    /// Shared `&`/`|`/`^` dispatch (ECMA-262's `BigInt::bitwiseOp`): decode
    /// both operands to same-length two's-complement word patterns, apply
    /// `word_op` word-by-word, then decode the outcome — `result_negative`
    /// gives the result's sign from whether each operand was negative (AND:
    /// both; OR: either; XOR: exactly one), and a negative outcome's word
    /// pattern is turned back into a magnitude via
    /// [`magnitude_from_twos_complement`].
    fn bitwise_op(
        self,
        rhs: Self,
        word_op: impl Fn(u64, u64) -> u64,
        result_negative: impl Fn(bool, bool) -> bool,
    ) -> Self {
        let self_negative = self.sign() == Sign::Negative;
        let rhs_negative = rhs.sign() == Sign::Negative;
        let len = self.length().max(rhs.length());
        let a = self.twos_complement_words(len);
        let b = rhs.twos_complement_words(len);
        let out: Vec<u64> = a
            .iter()
            .zip(b.iter())
            .map(|(&x, &y)| word_op(x, y))
            .collect();
        if result_negative(self_negative, rhs_negative) {
            Self::normalize_new(Sign::Negative, magnitude_from_twos_complement(out))
        } else {
            Self::normalize_new(Sign::Positive, out)
        }
    }
}

/// Panics if the slice is not normalized, i.e. if it has leading
/// (most-significant) zero words.
fn assert_slice_normalized<I: Uint, T: SizedIndex<I, Output = u64> + ?Sized>(v: &T) {
    if let Some(&last) = v.last()
        && last == 0
    {
        panic!("BigInt is not normalized (has leading zero words)");
    }
}

#[cfg(test)]
mod tests {
    use super::{
        add_one, cmp_words, sub_one, sub_words_assign, sub_words_borrow,
        test_util::{T, int, pos},
        trim,
    };
    use core::cmp::Ordering;

    // Tests for the word layer

    #[test]
    fn test_trim() {
        for (words, trimmed) in [
            ([].to_vec(), [].to_vec()),
            ([0].to_vec(), [].to_vec()),
            ([0, 0].to_vec(), [].to_vec()),
            ([1, 0, 0].to_vec(), [1].to_vec()),
            ([0, 1].to_vec(), [0, 1].to_vec()),
            ([0, 1, 0].to_vec(), [0, 1].to_vec()),
        ] {
            let mut words: Vec<u64> = words;
            trim(&mut words);
            assert_eq!(words, trimmed);
        }
    }

    #[test]
    fn test_cmp_words() {
        let cmp = |a: &[u64], b: &[u64]| cmp_words(a, b);
        assert_eq!(cmp(&[], &[]), Ordering::Equal);
        assert_eq!(cmp(&[], &[1]), Ordering::Less);
        assert_eq!(cmp(&[u64::MAX], &[0, 1]), Ordering::Less);
        assert_eq!(cmp(&[5, 10], &[20, 9]), Ordering::Greater);
        assert_eq!(cmp(&[20, 9], &[5, 10]), Ordering::Less);
        assert_eq!(cmp(&[2, 7], &[1, 7]), Ordering::Greater);
        assert_eq!(cmp(&[1, 7], &[1, 7]), Ordering::Equal);
    }

    #[test]
    fn test_sub_words_borrow() {
        // No borrow, and a shorter `b` read as zero past its end.
        let mut a = [300u64, 2];
        assert!(!sub_words_borrow(&mut a, [100u64]));
        assert_eq!(a, [200, 2]);
        // A borrow that ripples through a zero word.
        let mut a = [0u64, 0, 1];
        assert!(!sub_words_borrow(&mut a, [1u64]));
        assert_eq!(a, [u64::MAX, u64::MAX, 0]);
        // `b > a`: the borrow comes out, and `a` wraps.
        let mut a = [1u64];
        assert!(sub_words_borrow(&mut a, [2u64]));
        assert_eq!(a, [u64::MAX]);
        // A borrow plus a word subtraction in the same word.
        let mut a = [0u64, 5];
        assert!(!sub_words_borrow(&mut a, [1u64, 4]));
        assert_eq!(a, [u64::MAX, 0]);
    }

    #[test]
    fn test_sub_words_assign_trims() {
        let mut a = [0u64, 5].to_vec();
        sub_words_assign(&mut a, &[1, 4]);
        assert_eq!(a, [u64::MAX]);
        let mut a = [7u64, 3].to_vec();
        sub_words_assign(&mut a, &[7, 3]);
        assert_eq!(a, []);
    }

    #[test]
    fn test_add_one() {
        for (words, sum) in [
            ([].to_vec(), [1].to_vec()),
            ([41].to_vec(), [42].to_vec()),
            ([u64::MAX, 3].to_vec(), [0, 4].to_vec()),
            ([u64::MAX, u64::MAX].to_vec(), [0, 0, 1].to_vec()),
        ] {
            let mut words: Vec<u64> = words;
            add_one(&mut words);
            assert_eq!(words, sum);
        }
    }

    #[test]
    fn test_sub_one() {
        let mut words = [42u64];
        sub_one(&mut words);
        assert_eq!(words, [41]);
        // The borrow ripples, and the length stays: no trim.
        let mut words = [0u64, 0, 1];
        sub_one(&mut words);
        assert_eq!(words, [u64::MAX, u64::MAX, 0]);
        let mut words = [0u64, 4];
        sub_one(&mut words);
        assert_eq!(words, [u64::MAX, 3]);
    }

    #[test]
    fn test_abs_cmp_vec_equal_numbers() {
        let a: T = 12_345u64.into();
        let b: T = 12_345u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Equal);
    }

    #[test]
    fn test_abs_cmp_vec_equal_zero() {
        let a: T = 0u64.into();
        let b: T = 0u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Equal);
    }

    #[test]
    fn test_abs_cmp_vec_simple_different_lengths() {
        let one_digit = pos([100u64]);
        let two_digits = pos([100u64, 1u64]);
        assert_eq!(
            two_digits.clone().abs_cmp_vec(one_digit.clone()),
            Ordering::Greater
        );
        assert_eq!(one_digit.abs_cmp_vec(two_digits), Ordering::Less);
    }

    #[test]
    fn test_abs_cmp_vec_same_length_first_greater() {
        let a: T = 12_346u64.into();
        let b: T = 12_345u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Greater);
    }

    #[test]
    fn test_abs_cmp_vec_same_length_first_less() {
        let a: T = 12_344u64.into();
        let b: T = 12_345u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Less);
    }

    #[test]
    fn test_abs_cmp_vec_most_significant_digit_differs() {
        let a: T = 0x8000_0000_0000_0000u64.into();
        let b: T = 0x7FFF_FFFF_FFFF_FFFFu64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Greater);
    }

    #[test]
    fn test_abs_cmp_vec_least_significant_digit_differs() {
        let a: T = 0x1000_0000_0000_0001u64.into();
        let b: T = 0x1000_0000_0000_0000u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Greater);
    }

    #[test]
    fn test_abs_cmp_vec_zero_vs_nonzero() {
        let a: T = 0u64.into();
        let b: T = 1u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Less);

        let a: T = 1u64.into();
        let b: T = 0u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Greater);
    }

    #[test]
    fn test_abs_cmp_vec_simple_large_numbers() {
        // Test with large u64 numbers instead of multi-digit
        let large1: T = 0xFFFF_FFFF_FFFF_FFFFu64.into();
        let large2: T = 0xFFFF_FFFF_FFFF_FFFEu64.into();

        assert_eq!(
            large1.clone().abs_cmp_vec(large2.clone()),
            Ordering::Greater
        );
        assert_eq!(large2.clone().abs_cmp_vec(large1.clone()), Ordering::Less);
        assert_eq!(large1.clone().abs_cmp_vec(large1.clone()), Ordering::Equal);
    }

    #[test]
    fn test_abs_cmp_vec_simple_equal() {
        let large1: T = 0x1234_5678_9ABC_DEF0u64.into();
        let large2: T = 0x1234_5678_9ABC_DEF0u64.into();

        assert_eq!(large1.abs_cmp_vec(large2), Ordering::Equal);
    }

    #[test]
    fn test_abs_cmp_vec_simple_digit_difference() {
        // Test simple cases where we know the expected result
        let large1: T = 0x8000_0000_0000_0000u64.into();
        let large2: T = 0x7FFF_FFFF_FFFF_FFFFu64.into();

        assert_eq!(large1.abs_cmp_vec(large2), Ordering::Greater);
    }

    #[test]
    fn test_abs_cmp_vec_two_digits_higher_word_dominates() {
        // Test where self's lower word < rhs lower word, but self's higher word > rhs higher word
        // self = [5, 10] represents 10 * 2^64 + 5
        // rhs = [20, 9] represents 9 * 2^64 + 20
        // Since higher word is more significant, self should be greater despite lower word being smaller
        let self_val = pos([5u64, 10u64]);
        let rhs_val = pos([20u64, 9u64]);

        assert_eq!(self_val.abs_cmp_vec(rhs_val), Ordering::Greater);
    }

    #[test]
    fn test_div_mod_pairs_quotient_and_remainder() {
        for (a, b, q, r) in [
            (10, 3, 3, 1),
            (-10, 3, -3, -1),
            (10, -3, -3, 1),
            (-10, -3, 3, -1),
            // `div_mod` picks each result's sign before it knows the
            // magnitude; a zero result must still come out positive.
            (-1, 2, 0, -1),
            (1, -2, 0, 1),
            (-4, 2, -2, 0),
            (4, -2, -2, 0),
        ] {
            let (quotient, remainder) = int(a).div_mod(int(b)).unwrap();
            // `==` ignores the sign of a zero, so the sign is pinned apart.
            assert_eq!(quotient.sign(), int(q).sign());
            assert_eq!(remainder.sign(), int(r).sign());
            assert_eq!(quotient, int(q));
            assert_eq!(remainder, int(r));
        }
    }

    #[test]
    fn test_div_mod_zero_divisor_throws() {
        let a: T = 5u64.into();
        assert!(a.div_mod(T::default()).is_err());
    }

    // Tests for abs_add_vec

    #[test]
    fn test_abs_add_vec_basic() {
        let a: T = 123u64.into();
        let b: T = 456u64.into();
        let result = a.abs_add_vec(b);
        let expected = pos(result);
        let expected_value: T = 579u64.into();
        assert_eq!(expected.abs_cmp_vec(expected_value), Ordering::Equal);
    }

    #[test]
    fn test_abs_add_vec_zero() {
        let a: T = 42u64.into();
        let b: T = 0u64.into();
        let result = a.clone().abs_add_vec(b);
        let result_bigint = pos(result);
        assert_eq!(result_bigint.abs_cmp_vec(a), Ordering::Equal);

        let c: T = 0u64.into();
        let d: T = 17u64.into();
        let result2 = c.abs_add_vec(d.clone());
        let result2_bigint = pos(result2);
        assert_eq!(result2_bigint.abs_cmp_vec(d), Ordering::Equal);
    }

    #[test]
    fn test_abs_add_vec_carry() {
        let a: T = u64::MAX.into();
        let b: T = 1u64.into();
        let result = a.abs_add_vec(b);

        // u64::MAX + 1 should produce [0, 1] (carry to next digit)
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], 0u64);
        assert_eq!(result[1], 1u64);
    }

    #[test]
    fn test_abs_add_vec_different_lengths() {
        let small = pos([100u64]);
        let large = pos([200u64, 1u64]);

        let result1 = small.clone().abs_add_vec(large.clone());
        let result2 = large.abs_add_vec(small);

        // Addition should be commutative
        assert_eq!(result1.len(), result2.len());
        for (a, b) in result1.iter().zip(result2.iter()) {
            assert_eq!(a, b);
        }

        // Result should be [300, 1]
        assert_eq!(result1[0], 300u64);
        assert_eq!(result1[1], 1u64);
    }

    #[test]
    fn test_abs_add_vec_multiple_carries() {
        let a = pos([u64::MAX, u64::MAX]);
        let b: T = 1u64.into();

        let result = a.abs_add_vec(b);

        // [u64::MAX, u64::MAX] + 1 should produce [0, 0, 1]
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], 0u64);
        assert_eq!(result[1], 0u64);
        assert_eq!(result[2], 1u64);
    }

    #[test]
    fn test_abs_add_vec_same_large_numbers() {
        let large: T = 0x7FFF_FFFF_FFFF_FFFFu64.into();
        let result = large.clone().abs_add_vec(large);
        let result_bigint = pos(result);

        let expected: T = 0xFFFF_FFFF_FFFF_FFFEu64.into();
        assert_eq!(result_bigint.abs_cmp_vec(expected), Ordering::Equal);
    }

    #[test]
    fn test_abs_add_vec_no_carry() {
        let a: T = 1_000u64.into();
        let b: T = 2_000u64.into();
        let result = a.abs_add_vec(b);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 3_000u64);
    }

    #[test]
    fn test_abs_add_vec_both_zero() {
        let a: T = 0u64.into();
        let b: T = 0u64.into();
        let result = a.abs_add_vec(b);

        // Zero might be represented as empty vector in this implementation
        assert!(result.is_empty() || (result.len() == 1 && result[0] == 0u64));
    }

    // Tests for abs_sub_vec

    #[test]
    fn test_abs_sub_vec_basic() {
        let a: T = 456u64.into();
        let b: T = 123u64.into();
        let result = a.abs_sub_vec(b);
        let result_bigint = pos(result);
        let expected: T = 333u64.into();
        assert_eq!(result_bigint.abs_cmp_vec(expected), Ordering::Equal);
    }

    #[test]
    fn test_abs_sub_vec_same_numbers() {
        let a: T = 12_345u64.into();
        let result = a.clone().abs_sub_vec(a);

        // Result should be zero (empty vec or [0])
        assert!(result.is_empty() || (result.len() == 1 && result[0] == 0u64));
    }

    #[test]
    fn test_abs_sub_vec_subtract_zero() {
        let a: T = 42u64.into();
        let b: T = 0u64.into();
        let result = a.clone().abs_sub_vec(b);
        let result_bigint = pos(result);
        assert_eq!(result_bigint.abs_cmp_vec(a), Ordering::Equal);
    }

    #[test]
    fn test_abs_sub_vec_with_borrow() {
        let a: T = 1_000u64.into();
        let b: T = 1u64.into();
        let result = a.abs_sub_vec(b);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 999u64);
    }

    #[test]
    fn test_abs_sub_vec_different_lengths() {
        let large = pos([300u64, 2u64]);
        let small = pos([100u64]);

        let result = large.abs_sub_vec(small);

        // [300, 2] - [100] should be [200, 2]
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], 200u64);
        assert_eq!(result[1], 2u64);
    }

    #[test]
    fn test_abs_sub_vec_borrow_propagation() {
        let a = pos([0u64, 1u64]); // 2^64
        let b: T = 1u64.into();

        let result = a.abs_sub_vec(b);

        // 2^64 - 1 should be u64::MAX
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], u64::MAX);
    }

    #[test]
    fn test_abs_sub_vec_leading_zero_trim() {
        let a = pos([100u64, 1u64]);
        let b = pos([100u64, 1u64]);

        let result = a.abs_sub_vec(b);

        // Should trim leading zeros and result in empty or [0]
        assert!(result.is_empty() || (result.len() == 1 && result[0] == 0u64));
    }

    #[test]
    fn test_abs_sub_vec_large_numbers() {
        let a: T = u64::MAX.into();
        let b: T = (u64::MAX - 1_000u64).into();
        let result = a.abs_sub_vec(b);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 1_000u64);
    }

    #[test]
    fn test_abs_sub_vec_no_borrow() {
        let a: T = 5_000u64.into();
        let b: T = 2_000u64.into();
        let result = a.abs_sub_vec(b);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 3_000u64);
    }

    #[test]
    #[should_panic(expected = "abs_sub_vec: rhs is greater than self")]
    fn test_abs_sub_vec_panic_rhs_greater() {
        let a: T = 100u64.into();
        let b: T = 200u64.into();
        let _ = a.abs_sub_vec(b); // Should panic
    }

    #[test]
    #[should_panic(expected = "abs_sub_vec: rhs is greater than self")]
    fn test_abs_sub_vec_panic_different_lengths() {
        let small = pos([100u64]);
        let large = pos([100u64, 1u64]);
        let _ = small.abs_sub_vec(large); // Should panic - small < large
    }
}
