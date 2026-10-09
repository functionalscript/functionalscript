use super::MAX_WORDS;
use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{Any, BigInt, IVm, error},
};

use std::ops::Mul;

// BigInt's Mul is implemented here, not under impls, because it needs private BigInt's stuff.
/// `*`, or the `RangeError` of a product longer than `MAX_WORDS` words, as
/// `<<` throws for a shift that long.
impl<A: IVm> Mul for BigInt<A> {
    type Output = Result<Self, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        if self.is_zero() || rhs.is_zero() {
            return Ok(Self::default());
        }

        let lhs_max = self.length() - 1;
        let rhs_max = rhs.length() - 1;

        // The product has `lhs + rhs` words or one fewer, so this refuses
        // before anything is allocated every product that is surely past the
        // limit, and bounds the buffer below by `MAX_WORDS + 1` words (128
        // KiB). The product of that many words is checked again once it is
        // normalized.
        if u64::from(lhs_max) + u64::from(rhs_max) + 1 > MAX_WORDS {
            return Err(error::bigint_too_large());
        }

        // TODO: 1. Implement Karatsuba multiplication for large numbers.
        //       2. For 'value', create mutable BigInt instead of Vec<u64>.
        //       3. Ask self, _rhs for mutable access and operate in-place on one of them (if available).
        let total_max = lhs_max + rhs_max + 1;
        let mut value: Vec<u64> = Vec::new();
        if value.try_reserve_exact((total_max + 1) as usize).is_err() {
            return Err(error::bigint_too_large());
        }
        value.resize((total_max + 1) as usize, 0);
        let mut i: u32 = 0;
        while i < total_max {
            let mut j = i.saturating_sub(rhs_max);
            let max = if i < lhs_max { i } else { lhs_max };
            while j <= max {
                value = Self::add_to_vec(value, i, self[j] as u128 * rhs[i - j] as u128);
                j += 1;
            }
            i += 1;
        }

        let sign = if self.sign() == rhs.sign() {
            Sign::Positive
        } else {
            Sign::Negative
        };

        let product = Self::normalize_new(sign, value);
        if u64::from(product.length()) > MAX_WORDS {
            return Err(error::bigint_too_large());
        }
        Ok(product)
    }
}

// TODO: The unit tests should not use `naive` or other VM implementations.
//       We should move these tests into integration tests.
#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{bigint::BigInt, error},
    };

    type T = BigInt<Naive>;

    fn int(value: i64) -> T {
        value.into()
    }

    fn pow2(bit: i64) -> T {
        (int(1) << int(bit)).unwrap()
    }

    #[test]
    fn sign_combinations() {
        assert_eq!(int(3) * int(5), Ok(int(15)));
        assert_eq!(int(-3) * int(5), Ok(int(-15)));
        assert_eq!(int(3) * int(-5), Ok(int(-15)));
        assert_eq!(int(-3) * int(-5), Ok(int(15)));
    }

    #[test]
    fn zero_operand() {
        assert_eq!(int(3) * int(0), Ok(T::default()));
        assert_eq!(int(0) * int(-3), Ok(T::default()));
    }

    /// A product of exactly `MAX_WORDS` words, 16384, is a product: `2^62`
    /// is one word, `2^1048513` is 16383, and their product is
    /// `2^1048575`. The operands are lopsided to keep the work small.
    #[test]
    fn product_at_the_limit() {
        assert_eq!(pow2(62) * pow2(1_048_513), Ok(pow2(1_048_575)));
        assert_eq!(-pow2(62) * pow2(1_048_513), Ok(-pow2(1_048_575)));
    }

    /// One word more is `RangeError`, whichever of the two checks sees it.
    /// `2^63` times `2^1048513` passes the first, which looks at the operands'
    /// lengths, and is refused by the second once its 16385 words are known.
    /// `2^64` (two words) times `2^1048575` (16384) is refused by the first,
    /// before anything is allocated.
    #[test]
    fn product_past_the_limit() {
        let refused = Err(error::bigint_too_large());
        assert_eq!(pow2(63) * pow2(1_048_513), refused);
        assert_eq!(-pow2(63) * pow2(1_048_513), refused);
        assert_eq!(pow2(64) * pow2(1_048_575), refused);
    }
}
