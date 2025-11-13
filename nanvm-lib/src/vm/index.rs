use core::ops::Index;

use crate::vm::{Any, Array, IContainer, IVm, String16};

impl<A: IVm> Index<u32> for Array<A> {
    type Output = Any<A>;
    /// Currently panics if out of bounds.
    /// TODO: Future versions may change to return `Nullish::Undefined`.
    fn index(&self, index: u32) -> &Self::Output {
        self.0.items().index(index as usize)
    }
}

impl<A: IVm> Index<u32> for String16<A> {
    type Output = u16;
    /// Currently panics if out of bounds.
    /// TODO: Future versions may change to return `Option<u16>`.
    /// Also we can implement `Index<Any<A>>`, `Index<f64>` and `Index<String16>`.
    fn index(&self, index: u32) -> &Self::Output {
        self.0.items().index(index as usize)
    }
}
