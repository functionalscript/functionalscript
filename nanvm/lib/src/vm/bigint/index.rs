use core::ops::Index;

use crate::vm::{BigInt, ContainerWrapper, IVm};

impl<A: IVm> Index<u32> for BigInt<A> {
    type Output = u64;
    fn index(&self, index: u32) -> &Self::Output {
        self.item(index)
    }
}

impl<A: IVm> ContainerWrapper for BigInt<A> {
    type Vm = A;
    type Internal = A::InternalBigInt;
    fn internal(&self) -> &Self::Internal {
        &self.0
    }
}
