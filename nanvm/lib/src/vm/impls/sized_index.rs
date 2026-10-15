use core::ops::Index;

use crate::{
    common::sized_index::SizedIndex,
    vm::{IContainer, IVm},
};

/// A wrapper newtype over a VM container — `String<A>`, `Array<A>`,
/// `Object<A>`, `BigInt<A>` — and the container it wraps. Each wrapper
/// implements it once, beside its `Index<u32>`, which delegates to
/// [`item`](Self::item); `SizedIndex<u32>` follows from the blanket impl
/// below.
pub trait ContainerWrapper: Index<u32> {
    type Vm: IVm;
    type Internal: IContainer<Self::Vm, Item = Self::Output>;
    fn internal(&self) -> &Self::Internal;
    /// The item at `index`; panics if out of bounds.
    fn item(&self, index: u32) -> &Self::Output {
        self.internal().items().index(index as usize)
    }
}

impl<W: ContainerWrapper> SizedIndex<u32> for W {
    fn length(&self) -> u32 {
        self.internal().items().length() as u32
    }
}
