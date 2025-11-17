use core::ops::Index;

use crate::common::{default::default, index_iter::IndexIter};

pub trait SizedIndex<I>: Index<I> {
    fn length(&self) -> I;
    fn is_empty(&self) -> bool
    where
        I: Default + PartialEq,
    {
        self.length() == default()
    }
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
