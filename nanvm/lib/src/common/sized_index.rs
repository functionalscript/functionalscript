use crate::common::{default::default, index_iter::IndexIter, uint::Uint};

/// A container read by `I` from `0` up to [`length`](Self::length).
///
/// An item is read by value, so a container need not hold its items in the
/// form it answers them in: a string of bytes answers `u16` code units.
///
/// The length is fixed: it does not change for as long as the container is
/// held, so [`IndexIter`] can promise an exact `size_hint` and stay fused. A
/// container with interior mutability that could change its length must not
/// implement this trait.
pub trait SizedIndex<I: Uint> {
    type Output;
    fn length(&self) -> I;
    /// The item at `i`; panics if out of bounds.
    fn item(&self, i: I) -> Self::Output;
    fn is_empty(&self) -> bool {
        self.length() == default()
    }
    /// Item `i` if it is below [`length`](Self::length), and `None` past
    /// the end, where [`item`](Self::item) panics: the bound every reader
    /// of an item that may be absent would otherwise write for itself.
    fn get(&self, i: I) -> Option<Self::Output> {
        if i < self.length() {
            Some(self.item(i))
        } else {
            None
        }
    }
    fn last(&self) -> Option<Self::Output> {
        if self.is_empty() {
            None
        } else {
            Some(self.item(self.length() - 1.into()))
        }
    }
    fn index_iter(self) -> IndexIter<I, Self>
    where
        Self: Sized,
    {
        IndexIter::new(self)
    }
}

impl<T: Clone> SizedIndex<usize> for [T] {
    type Output = T;
    fn length(&self) -> usize {
        self.len()
    }
    fn item(&self, i: usize) -> T {
        self[i].clone()
    }
}

#[cfg(test)]
mod tests {
    use super::SizedIndex;
    use crate::{naive::Naive, vm::String};

    /// An index below the length is its element; the length and past it
    /// are `None`, where `item` would panic.
    #[test]
    fn get() {
        let s: String<Naive> = "ab".into();
        assert_eq!(s.get(0), Some(0x61));
        assert_eq!(s.get(1), Some(0x62));
        assert_eq!(s.get(2), None);
        assert_eq!(s.get(u32::MAX), None);
        assert_eq!(String::<Naive>::from("").get(0), None);
    }
}
