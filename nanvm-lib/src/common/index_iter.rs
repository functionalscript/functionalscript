use core::ops::AddAssign;

use crate::common::{default::default, sized_index::SizedIndex};

pub struct IndexIter<I, T> {
    container: T,
    i: I,
}

impl<I: Default + PartialEq, T: SizedIndex<I>> IndexIter<I, T> {
    pub fn new(container: T) -> Self {
        Self { container, i: default() }
    }
}

impl<I: Copy + Default + PartialEq + AddAssign + From<u8>, T: SizedIndex<I, Output: Clone>> Iterator
    for IndexIter<I, T>
{
    type Item = T::Output;
    fn next(&mut self) -> Option<Self::Item> {
        let i = self.i;
        if i == self.container.length() {
            return None;
        }
        self.i += 1.into();
        Some(self.container[i].clone())
    }
}
