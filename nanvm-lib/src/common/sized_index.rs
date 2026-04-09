use core::ops::{Index, Sub};

use crate::common::{default::default, index_iter::IndexIter};

pub trait SizedIndex<I: Default + PartialEq + Sub<Output = I> + From<u8>>: Index<I> {
    fn length(&self) -> I;
    fn is_empty(&self) -> bool {
        self.length() == default()
    }
    fn last(&self) -> Option<&Self::Output> {
        if self.is_empty() {
            None
        } else {
            Some(&self[self.length() - 1.into()])
        }
    }
    fn index_iter(self) -> IndexIter<I, Self>
    where
        Self: Sized,
    {
        IndexIter::new(self)
    }
}

impl<T> SizedIndex<usize> for [T] {
    fn length(&self) -> usize {
        self.len()
    }
}
