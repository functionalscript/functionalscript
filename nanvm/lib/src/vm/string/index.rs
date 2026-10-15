use core::ops::Index;

use crate::vm::{ContainerWrapper, IVm, String};

impl<A: IVm> Index<u32> for String<A> {
    type Output = u16;
    /// Currently panics if out of bounds.
    /// TODO: Future versions may change to return `Result<u16, Any<A>>`.
    /// Also we can implement `Index<Any<A>>`, `Index<f64>` and `Index<String16>`.
    fn index(&self, index: u32) -> &Self::Output {
        self.item(index)
    }
}

impl<A: IVm> ContainerWrapper for String<A> {
    type Vm = A;
    type Internal = A::InternalString;
    fn internal(&self) -> &Self::Internal {
        &self.0
    }
}
