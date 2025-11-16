use crate::{
    common::sized_index::{SizedIndex, SizedIndexIter},
    vm::{Any, Array, IVm},
};

impl<A: IVm> IntoIterator for Array<A> {
    type Item = Any<A>;
    type IntoIter = SizedIndexIter<u32, Array<A>>;
    fn into_iter(self) -> Self::IntoIter {
        self.si_iter()
    }
}
