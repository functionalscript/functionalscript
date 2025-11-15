use core::ops::Index;

use crate::vm::{IContainer, IVm, Object, Property};

impl<A: IVm> Index<u32> for Object<A> {
    type Output = Property<A>;
    /// Currently panics if out of bounds.
    /// TODO: Future versions may change to return `Nullish::Undefined`.
    fn index(&self, index: u32) -> &Self::Output {
        self.0.items().index(index as usize)
    }
}
