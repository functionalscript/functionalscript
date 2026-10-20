use core::iter::FusedIterator;

use crate::common::{default::default, sized_index::SizedIndex, uint::Uint};

pub struct IndexIter<I, T> {
    container: T,
    i: I,
}

impl<I: Uint, T: SizedIndex<I>> IndexIter<I, T> {
    pub fn new(container: T) -> Self {
        Self {
            container,
            i: default(),
        }
    }
}

impl<I: Uint, T: SizedIndex<I, Output: Clone>> Iterator for IndexIter<I, T> {
    type Item = T::Output;
    fn next(&mut self) -> Option<Self::Item> {
        let i = self.i;
        if i == self.container.length() {
            return None;
        }
        self.i += 1.into();
        Some(self.container[i].clone())
    }
    /// Exact: a [`SizedIndex`]'s length is fixed.
    fn size_hint(&self) -> (usize, Option<usize>) {
        let left = (self.container.length() - self.i).to_usize();
        (left, Some(left))
    }
}

impl<I: Uint, T: SizedIndex<I, Output: Clone>> ExactSizeIterator for IndexIter<I, T> {}

impl<I: Uint, T: SizedIndex<I, Output: Clone>> FusedIterator for IndexIter<I, T> {}

#[cfg(test)]
mod tests {
    use crate::{naive::Naive, vm::String};

    #[test]
    fn exact_and_fused() {
        let s: String<Naive> = "ab".into();
        let mut i = s.into_iter();
        assert_eq!(i.len(), 2);
        assert_eq!(i.next(), Some(0x61));
        assert_eq!(i.size_hint(), (1, Some(1)));
        assert_eq!(i.next(), Some(0x62));
        assert_eq!(i.len(), 0);
        assert_eq!(i.next(), None);
        assert_eq!(i.next(), None);
    }
}
