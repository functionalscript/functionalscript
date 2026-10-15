use core::ops::Index;

use crate::vm::{ContainerWrapper, IVm, Object, Property};

impl<A: IVm> Index<u32> for Object<A> {
    type Output = Property<A>;
    /// Currently panics if out of bounds.
    /// TODO: Future versions may change to return `Nullish::Undefined`.
    fn index(&self, index: u32) -> &Self::Output {
        self.item(index)
    }
}

impl<A: IVm> ContainerWrapper for Object<A> {
    type Vm = A;
    type Internal = A::InternalObject;
    fn internal(&self) -> &Self::Internal {
        &self.0
    }
}
