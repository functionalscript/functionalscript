use core::ops::Index;

use crate::vm::{Any, Array, ContainerWrapper, IVm};

impl<A: IVm> Index<u32> for Array<A> {
    type Output = Any<A>;
    /// Currently panics if out of bounds.
    /// TODO: Future versions may change to return `Nullish::Undefined`.
    fn index(&self, index: u32) -> &Self::Output {
        self.item(index)
    }
}

impl<A: IVm> ContainerWrapper for Array<A> {
    type Vm = A;
    type Internal = A::InternalArray;
    fn internal(&self) -> &Self::Internal {
        &self.0
    }
}
