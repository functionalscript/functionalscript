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

pub struct ObjectIter<A: IVm> {
    object: Object<A>,
    indices: core::ops::Range<u32>,
}

impl<A: IVm> Iterator for ObjectIter<A> {
    type Item = Property<A>;
    fn next(&mut self) -> Option<Self::Item> {
        self.indices.next().map(|i| self.object.property_at(i))
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.indices.size_hint()
    }
}

impl<A: IVm> ExactSizeIterator for ObjectIter<A> {}
impl<A: IVm> core::iter::FusedIterator for ObjectIter<A> {}

impl<A: IVm> IntoIterator for Object<A> {
    type Item = Property<A>;
    type IntoIter = ObjectIter<A>;
    fn into_iter(self) -> Self::IntoIter {
        ObjectIter {
            indices: 0..self.length(),
            object: self,
        }
    }
}

impl<A: IVm> IntoIterator for String<A> {
    type Item = u16;
    type IntoIter = Iter<String<A>>;
    fn into_iter(self) -> Self::IntoIter {
        self.index_iter()
    }
}
