use crate::{
    common::{default::default, sized_index::SizedIndex},
    sign::Sign,
    vm::{BigInt, IContainer, IVm},
};

use std::ops::Mul;

pub fn new_resize<T: Default + Clone>(size: usize) -> Vec<T> {
    let mut vec = Vec::with_capacity(size);
    vec.resize(size, default());
    vec
}

pub fn normalize(vec: &mut Vec<u64>) {
    while let Some(&0) = vec.last() {
        vec.pop();
    }
}

impl<A: IVm> Mul for BigInt<A> {
    type Output = Self;

    fn mul(self, rhs: Self) -> Self {
        if self.is_zero() || rhs.is_zero() {
            return Self::new(Sign::Positive, []);
        }

        let lhs_max = self.length() - 1;
        let rhs_max = rhs.length() - 1;

        // TODO: 1. Implement Karatsuba multiplication for large numbers.
        //       2. For 'value', reate mutable BigInt instead of Vec<u64>.
        //       3. Ask self, _rhs for mutable access and operate in-place on one of them (if available).
        let total_max = lhs_max + rhs_max + 1;
        let mut value = new_resize((total_max + 1) as usize);
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
        normalize(&mut value);

        let sign = if self.0.header() == rhs.0.header() {
            Sign::Positive
        } else {
            Sign::Negative
        };

        Self::new(sign, value)
    }
}
