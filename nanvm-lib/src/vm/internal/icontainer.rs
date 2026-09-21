use core::fmt::Debug;

use crate::{common::sized_index::SizedIndex, vm::IVm};

use super::IComplex;

/// A sequence with a header: a string, a bigint, an array, an object.
pub trait IContainer<A: IVm>: IComplex<A> {
    // types
    type Header: PartialEq + Clone;
    type Item: Debug + Clone;
    type Items: ?Sized + SizedIndex<usize, Output = Self::Item>;

    // functions
    fn new<E>(
        header: Self::Header,
        i: impl IntoIterator<Item = Result<Self::Item, E>>,
    ) -> Result<Self, E>;
    fn header(&self) -> &Self::Header;
    fn items(&self) -> &Self::Items;

    // extensions

    fn new_ok(header: Self::Header, i: impl IntoIterator<Item = Self::Item>) -> Self {
        Self::new::<()>(header, i.into_iter().map(Ok)).unwrap()
    }

    fn items_eq(&self, b: &Self) -> bool
    where
        Self::Header: PartialEq,
        Self::Item: PartialEq,
    {
        if self.header() != b.header() {
            return false;
        }
        let a = self.items();
        let b = b.items();
        let len = a.length();
        if len != b.length() {
            return false;
        }
        for i in 0..len {
            if a[i] != b[i] {
                return false;
            }
        }
        true
    }
}
