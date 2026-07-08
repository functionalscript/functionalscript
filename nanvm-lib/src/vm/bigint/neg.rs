use std::ops::Neg;

use crate::{
    common::sized_index::SizedIndex,
    vm::{BigInt, IContainer, IVm},
};

impl<A: IVm> Neg for BigInt<A> {
    type Output = Self;
    fn neg(self) -> Self::Output {
        if self.is_zero() {
            self
        } else {
            Self::unchecked_new(self.0.header().flip(), self.index_iter())
        }
    }
}
