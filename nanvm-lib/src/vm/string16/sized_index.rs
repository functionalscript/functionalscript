use crate::{
    common::array::SizedIndex,
    vm::{IContainer, IVm, String16},
};

impl<A: IVm> SizedIndex<u32> for String16<A> {
    fn length(&self) -> u32 {
        self.0.items().length() as u32
    }
}
