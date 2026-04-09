use crate::{
    common::{sized_index::SizedIndex, vec::with_default},
    sign::Sign,
    vm::{BigInt, IContainer, IVm},
};

use std::ops::Mul;

use super::normalize;

// BigInt's Mul is implemented here, not under impls, because it needs private BigInt's stuff.
impl<A: IVm> Mul for BigInt<A> {
    type Output = Self;

    fn mul(self, rhs: Self) -> Self {
        if self.is_zero() || rhs.is_zero() {
            return Self::default();
        }

        let lhs_max = self.length() - 1;
        let rhs_max = rhs.length() - 1;

        // TODO: 1. Implement Karatsuba multiplication for large numbers.
        //       2. For 'value', create mutable BigInt instead of Vec<u64>.
        //       3. Ask self, _rhs for mutable access and operate in-place on one of them (if available).
        let total_max = lhs_max + rhs_max + 1;
        let mut value = with_default((total_max + 1) as usize);
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

        let sign = if self.0.header() == rhs.0.header() {
            Sign::Positive
        } else {
            Sign::Negative
        };

        Self::normalize_new(sign, value)
    }
}
