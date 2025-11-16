use crate::{
    common::sized_index::{SizedIndex, SizedIndexIter},
    vm::{IVm, Object, Property},
};

impl<A: IVm> IntoIterator for Object<A> {
    type Item = Property<A>;
    type IntoIter = SizedIndexIter<u32, Object<A>>;
    fn into_iter(self) -> Self::IntoIter {
        self.si_iter()
    }
}
