use crate::vm::{ContainerWrapper, IVm, String};

impl<A: IVm> ContainerWrapper for String<A> {
    type Vm = A;
    type Internal = A::InternalString;
    fn internal(&self) -> &Self::Internal {
        &self.0
    }
}
