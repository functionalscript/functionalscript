use core::ops::AddAssign;

use crate::common::{default::default, sized_index::SizedIndex};

pub struct IndexIter<I, T> {
    c: T,
    i: I,
}

impl<I: Default, T: SizedIndex<I>> IndexIter<I, T> {
    pub fn new(c: T) -> Self {
        Self { c, i: default() }
    }
}

impl<I: Copy + Default + PartialEq + AddAssign + From<u8>, T: SizedIndex<I, Output: Clone>> Iterator
    for IndexIter<I, T>
{
    type Item = T::Output;
    fn next(&mut self) -> Option<Self::Item> {
        let i = self.i;
        if i == self.c.length() {
            return None;
        }
        self.i += 1.into();
        Some(self.c[i].clone())
    }
}
