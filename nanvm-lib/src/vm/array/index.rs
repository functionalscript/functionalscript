use core::ops::Index;

use crate::vm::{Any, Array, IContainer, IVm};

impl<A: IVm> Index<u32> for Array<A> {
    type Output = Any<A>;
    /// Currently panics if out of bounds.
    /// TODO: Future versions may change to return `Nullish::Undefined`.
    fn index(&self, index: u32) -> &Self::Output {
        self.0.items().index(index as usize)
    }
}
