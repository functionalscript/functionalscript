use crate::{/*sign::Sign,*/ vm::{BigInt, IVm}};

use std::ops::Mul;

impl<A: IVm> Mul for BigInt<A>
where
    A::InternalBigInt: AsRef<[u64]>,
{
    type Output = Self;

    fn mul(self, _rhs: Self) -> Self {
        todo!()
        // if self.is_zero() || _rhs.is_zero() {
        //     return Self::new(Sign::Positive, vec![]);
        // }

        // // use slices of the inner representation for multiplication
        // let a = self.0.as_ref();
        // let b = _rhs.0.as_ref();

        // let lhs_max = a.len() - 1;
        // let rhs_max = b.len() - 1;
        // let total_max = a.len() + b.len() - 1;
        // let mut value = new_resize(total_max + 1);
        // let mut i: usize = 0;
        // while i < total_max {
        //     let mut j = i.saturating_sub(rhs_max);
        //     let max = if i < lhs_max { i } else { lhs_max };
        //     while j <= max {
        //         value = add_to_vec(value, i, a[j] as u128 * b[i - j] as u128);
        //         j += 1;
        //     }
        //     i += 1;
        // }

        // let mut result = Self(value);
        // result.normalize();
        // result
    }
}
