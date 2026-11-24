use crate::vm::{BigInt, ContainerWrapper, IVm};

impl<A: IVm> ContainerWrapper for BigInt<A> {
    type Vm = A;
    type Internal = A::InternalBigInt;
    fn internal(&self) -> &Self::Internal {
        &self.0
    }
}
