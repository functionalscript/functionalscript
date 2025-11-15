use core::iter::empty;

use crate::{
    sign::Sign,
    vm::{BigInt, IVm},
};

impl<A: IVm> Default for BigInt<A> {
    fn default() -> Self {
        Self::new(Sign::Positive, empty())
    }
}
