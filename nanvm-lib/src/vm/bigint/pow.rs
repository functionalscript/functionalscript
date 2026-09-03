use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{Any, BigInt, IVm},
};

const NEGATIVE_EXPONENT: &str = "RangeError: Exponent must be non-negative";

impl<A: IVm> BigInt<A> {
    /// `**`. Not a `core::ops` trait — Rust has no operator for
    /// exponentiation, so this is a plain method, the same as `Any::pow`
    /// one level up.
    ///
    /// Exponentiation by squaring, walking the exponent's own bits rather
    /// than converting it to a Rust integer, so an exponent wider than
    /// `u64` still works. A negative exponent throws instead of coercing to
    /// a fraction, unlike `Number ** Number`, since `BigInt` has none.
    pub fn pow(self, rhs: Self) -> Result<Self, Any<A>> {
        if rhs.sign() == Sign::Negative {
            return Err(NEGATIVE_EXPONENT.into());
        }
        let exponent: Vec<u64> = rhs.index_iter().collect();
        // The word count times 64 overcounts: only bits up to the top word's
        // own highest set bit are ever meaningful. Squaring `base` beyond
        // that point would still be correct (the skipped bits are all zero,
        // so no further multiply ever triggers) but blows `base` up to an
        // astronomically large, wholly unused magnitude, so the loop stops
        // there instead.
        let bit_len = match exponent.last() {
            None => 0,
            Some(&top) => (exponent.len() as u32 - 1) * 64 + (64 - top.leading_zeros()),
        };

        let mut result = Self::from(1u64);
        let mut base = self;
        for bit in 0..bit_len {
            if (exponent[(bit / 64) as usize] >> (bit % 64)) & 1 != 0 {
                result = result * base.clone();
            }
            if bit + 1 < bit_len {
                base = base.clone() * base;
            }
        }
        Ok(result)
    }
}

// TODO: The unit tests should not use `naive` or other VM implementations.
//       We should move these tests into integration tests.
#[cfg(test)]
mod tests {
    use crate::{naive::Naive, vm::bigint::BigInt};

    type T = BigInt<Naive>;

    fn int(value: i64) -> T {
        value.into()
    }

    #[test]
    fn zero_exponent_gives_one() {
        assert_eq!(int(5).pow(int(0)).unwrap(), int(1));
        assert_eq!(int(0).pow(int(0)).unwrap(), int(1));
    }

    #[test]
    fn positive_exponent() {
        assert_eq!(int(2).pow(int(10)).unwrap(), int(1024));
    }

    #[test]
    fn negative_base_odd_and_even_exponent() {
        assert_eq!(int(-2).pow(int(3)).unwrap(), int(-8));
        assert_eq!(int(-2).pow(int(2)).unwrap(), int(4));
    }

    #[test]
    fn negative_exponent_throws() {
        assert!(int(2).pow(int(-1)).is_err());
    }

    #[test]
    fn zero_base_positive_exponent() {
        assert_eq!(int(0).pow(int(5)).unwrap(), T::default());
    }
}
