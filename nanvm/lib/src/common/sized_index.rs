use core::ops::Index;

use crate::common::{default::default, index_iter::IndexIter, uint::Uint};

/// A container indexed by `I` from `0` up to [`length`](Self::length).
///
/// The length is fixed: it does not change for as long as the container is
/// held, so [`IndexIter`] can promise an exact `size_hint` and stay fused. A
/// container with interior mutability that could change its length must not
/// implement this trait.
pub trait SizedIndex<I: Uint>: Index<I> {
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
