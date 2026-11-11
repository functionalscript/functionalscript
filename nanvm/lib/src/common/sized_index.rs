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
    /// Element `i` if it is below [`length`](Self::length), and `None` past
    /// the end, where `Index` panics: the bound every reader of an element
    /// that may be absent would otherwise write for itself.
    fn get(&self, i: I) -> Option<&Self::Output> {
        if i < self.length() {
            Some(&self[i])
        } else {
            None
        }
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

#[cfg(test)]
mod tests {
    use super::SizedIndex;
    use crate::{naive::Naive, vm::String};

    /// An index below the length is its element; the length and past it
    /// are `None`, where `Index` would panic.
    #[test]
    fn get() {
        let s: String<Naive> = "ab".into();
        assert_eq!(s.get(0), Some(&0x61));
        assert_eq!(s.get(1), Some(&0x62));
        assert_eq!(s.get(2), None);
        assert_eq!(s.get(u32::MAX), None);
        assert_eq!(String::<Naive>::from("").get(0), None);
    }
}
