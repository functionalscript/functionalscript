use crate::{
    sign::Sign,
    vm::{internal::IContainer, BigInt, IVm},
};

impl<A: IVm> Default for BigInt<A> {
    fn default() -> Self {
        Self(A::InternalBigInt::new_empty(Sign::Positive))
    }
}
