use core::{cmp::Ordering, ops::Sub};

use crate::vm::{BigInt, IContainer, IVm};

impl<A: IVm> Sub for BigInt<A> {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self::Output {
        let lhs_sign = *self.0.header();
        let rhs_sign = *rhs.0.header();
        let (sign, vec) = if lhs_sign == rhs_sign {
            match self.clone().abs_cmp_vec(rhs.clone()) {
                Ordering::Equal => return Self::default(),
                Ordering::Greater => (lhs_sign, self.abs_sub_vec(rhs)),
                Ordering::Less => (rhs_sign, rhs.abs_sub_vec(self)),
            }
        } else {
            (lhs_sign, self.abs_add_vec(rhs))
        };
        Self::new(sign, vec)
    }
}
