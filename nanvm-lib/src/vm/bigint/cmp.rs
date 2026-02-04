

use crate::vm::{bigint::BigInt, IVm};
use std::cmp::Ordering;

impl<A: IVm> PartialOrd for BigInt<A> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl<A: IVm> Ord for BigInt<A> {
    fn cmp(&self, rhs: &Self) -> Ordering {
        todo!()
    }
}
