use core::{fmt::Debug, iter};
use std::io;

use crate::{
    common::{serializable::Serializable, sized_index::SizedIndex},
    vm::IVm,
};

pub trait IContainer<A: IVm>: Sized + Clone + 'static {
    // types
    type Header: PartialEq + Serializable + Clone;
    type Item: Debug + Serializable + Clone;
    type Items: ?Sized + SizedIndex<usize, Output = Self::Item>;

    // functions
    fn new<E>(
        header: Self::Header,
        i: impl IntoIterator<Item = Result<Self::Item, E>>,
    ) -> Result<Self, E>;
    fn header(&self) -> &Self::Header;
    fn items(&self) -> &Self::Items;
    fn ptr_eq(&self, other: &Self) -> bool;

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

    fn serialize(self, write: &mut impl io::Write) -> io::Result<()> {
        self.header().clone().serialize(write)?;
        let items = self.items();
        let len = items.length();
        (len as u32).serialize(write)?;
        for i in 0..len {
            items[i].clone().serialize(write)?;
        }
        Ok(())
    }

    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        let header = Self::Header::deserialize(read)?;
        let mut len = u32::deserialize(read)?;
        let i = iter::from_fn(|| {
            if len > 0 {
                len -= 1;
                Some(Self::Item::deserialize(read))
            } else {
                None
            }
        });
        Self::new(header, i)
    }
}
