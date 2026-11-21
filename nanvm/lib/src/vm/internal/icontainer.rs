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

    /// A container of the items in `items`, which a VM may take over with
    /// no copy of each item, where [`new`](Self::new) collects an iterator.
    fn from_vec(header: Self::Header, items: Vec<Self::Item>) -> Self {
        Self::new_ok(header, items)
    }

    /// The items of `self` and then of `other`, in a new container of this
    /// header: each read once from its container's items, into a buffer of
    /// their total length.
    fn concat(&self, other: &Self) -> Self {
        let a = self.items();
        let b = other.items();
        let mut items = Vec::with_capacity(a.length() + b.length());
        items.extend((0..a.length()).map(|i| a[i].clone()));
        items.extend((0..b.length()).map(|i| b[i].clone()));
        Self::from_vec(self.header().clone(), items)
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
