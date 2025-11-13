use crate::common::sized_index::SizedIndex;

pub trait RandomAccess: SizedIndex<usize> {
    /// Note: using `IntoIterator` would require complicated lifetime bounds,
    /// which has to be used in all other places.
    /// `where for<'a> &'a Self: IntoIterator<Item = &'a Self::Output>`
    fn to_iter(&self) -> impl Iterator<Item = &Self::Output>;
}

impl<O> RandomAccess for [O] {
    fn to_iter(&self) -> impl Iterator<Item = &Self::Output> {
        self.iter()
    }
}
