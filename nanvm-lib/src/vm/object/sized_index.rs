use super::Object;
use crate::{
    common::sized_index::SizedIndex,
    vm::{IContainer, IVm},
};

impl<A: IVm> SizedIndex<u32> for Object<A> {
    fn length(&self) -> u32 {
        self.0.items().length() as u32
    }
}
