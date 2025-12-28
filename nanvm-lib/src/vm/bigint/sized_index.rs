use crate::{
    common::sized_index::SizedIndex,
    vm::{BigInt, IContainer, IVm},
};

impl<A: IVm> SizedIndex<u32> for BigInt<A> {
    fn length(&self) -> u32 {
        self.0.items().length() as u32
    }
}
