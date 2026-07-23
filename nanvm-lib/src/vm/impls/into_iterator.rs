use crate::{
    common::{index_iter::IndexIter, sized_index::SizedIndex},
    vm::{Any, Array, IVm, Object, Property, String},
};

type Iter<T> = IndexIter<u32, T>;

impl<A: IVm> IntoIterator for Array<A> {
    type Item = Any<A>;
    type IntoIter = Iter<Array<A>>;
    fn into_iter(self) -> Self::IntoIter {
        self.index_iter()
    }
}

impl<A: IVm> IntoIterator for Object<A> {
    type Item = Property<A>;
    type IntoIter = Iter<Object<A>>;
    fn into_iter(self) -> Self::IntoIter {
        self.index_iter()
    }
}

impl<A: IVm> IntoIterator for String<A> {
    type Item = u16;
    type IntoIter = Iter<String<A>>;
    fn into_iter(self) -> Self::IntoIter {
        self.index_iter()
    }
}
