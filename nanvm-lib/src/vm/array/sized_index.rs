use crate::{
    common::sized_index::SizedIndex,
    vm::{Array, IContainer, IVm},
};

impl<A: IVm> SizedIndex<u32> for Array<A> {
    fn length(&self) -> u32 {
        self.0.items().length() as u32
    }
}
