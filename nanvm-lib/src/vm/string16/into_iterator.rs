use crate::{
    common::sized_index::{SizedIndex, SizedIndexIter},
    vm::{IVm, String16},
};

impl<A: IVm> IntoIterator for String16<A> {
    type Item = u16;
    type IntoIter = SizedIndexIter<u32, String16<A>>;
    fn into_iter(self) -> Self::IntoIter {
        self.si_iter()
    }
}
