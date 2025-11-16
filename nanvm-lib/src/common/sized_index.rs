use core::ops::Index;

use crate::common::index_iter::IndexIter;

pub trait SizedIndex<I>: Index<I> {
    fn length(&self) -> I;
    fn index_iter(self) -> IndexIter<I, Self>
    where
        Self: Sized,
        I: Default,
    {
        IndexIter::new(self)
    }
}

impl<T> SizedIndex<usize> for [T] {
    fn length(&self) -> usize {
        self.len()
    }
}
