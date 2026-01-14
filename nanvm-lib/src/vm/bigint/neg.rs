use std::ops::Neg;

use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{BigInt, IContainer, IVm},
};

impl<A: IVm> Neg for BigInt<A> {
    type Output = Self;
    fn neg(self) -> Self::Output {
        if self.is_zero() {
            self
        } else {
            Self::new(
                match *self.0.header() {
                    Sign::Positive => Sign::Negative,
                    Sign::Negative => Sign::Positive,
                },
                self.index_iter(),
            )
        }
    }
}
