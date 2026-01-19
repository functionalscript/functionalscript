use crate::vm::{BigInt, IVm};

use std::ops::Mul;

impl<A: IVm> Mul for BigInt<A> {
    type Output = Self;

    fn mul(self, _rhs: Self) -> Self {
        todo!()
    }
}
