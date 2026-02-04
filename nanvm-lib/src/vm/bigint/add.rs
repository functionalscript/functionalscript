use core::{cmp::Ordering, ops::Add};

use crate::vm::{BigInt, IContainer, IVm};

// NOTE: use .index_iter in abs_* helpers.

fn abs_cmp_vec<A: IVm>(_lhs: BigInt<A>, _rhs: BigInt<A>) -> Ordering {
    todo!();
}

fn abs_add_vec<A: IVm>(_lhs: BigInt<A>, _rhs: BigInt<A>) -> Vec<u64> {
    todo!();
}

fn abs_sub_vec<A: IVm>(_lhs: BigInt<A>, _rhs: BigInt<A>) -> Vec<u64> {
    todo!();
}

impl<A: IVm> Add for BigInt<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        let lhs_sign = *self.0.header();
        let rhs_sign = *rhs.0.header();
        let (sign, vec) = if lhs_sign == rhs_sign {
            (lhs_sign, abs_add_vec(self, rhs))
        } else {
            match abs_cmp_vec(self.clone(), rhs.clone()) {
                Ordering::Equal => return Self::default(),
                Ordering::Greater => (lhs_sign, abs_sub_vec(self, rhs)),
                Ordering::Less => (rhs_sign, abs_sub_vec(rhs, self)),
            }
        };
        Self::new(sign, vec)
    }
}
