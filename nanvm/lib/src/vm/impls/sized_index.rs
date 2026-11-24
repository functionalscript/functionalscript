use crate::{
    common::sized_index::SizedIndex,
    vm::{IContainer, IVm},
};

/// A wrapper newtype over a VM container — `String<A>`, `Array<A>`,
/// `BigInt<A>` — and the container it wraps. `SizedIndex<u32>`, which reads
/// an item by value, follows from the blanket impl below.
pub trait ContainerWrapper {
    type Vm: IVm;
    type Internal: IContainer<Self::Vm>;
    fn internal(&self) -> &Self::Internal;
}

impl<W: ContainerWrapper> SizedIndex<u32> for W {
    type Output = <W::Internal as IContainer<W::Vm>>::Item;
    fn length(&self) -> u32 {
        self.internal().items().length() as u32
    }
    fn item(&self, index: u32) -> Self::Output {
        self.internal().items().item(index as usize)
    }
}
