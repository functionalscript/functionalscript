use std::rc::Rc;

use crate::{
    common::sized_index::SizedIndex,
    naive::Naive,
    vm::{IComplex, IContainer, StaticString},
};

/// Its own code units, or a constant's descriptor, read in the form it was written in.
pub enum String {
    Owned(Rc<[u16]>),
    Static(&'static StaticString),
}

impl Clone for String {
    /// Out of line: compiled code clones a value in thousands of places, and a
    /// release build that inlines the two branches at each of them is larger.
    #[inline(never)]
    fn clone(&self) -> Self {
        match self {
            Self::Owned(units) => Self::Owned(units.clone()),
            Self::Static(value) => Self::Static(value),
        }
    }
}

impl SizedIndex<usize> for String {
    type Output = u16;
    fn length(&self) -> usize {
        match self {
            Self::Owned(units) => units.len(),
            Self::Static(value) => value.length(),
        }
    }
    fn item(&self, i: usize) -> u16 {
        match self {
            Self::Owned(units) => units[i],
            Self::Static(value) => value.item(i),
        }
    }
}

impl IComplex<Naive> for String {
    fn ptr_eq(&self, other: &Self) -> bool {
        self.address() == other.address()
    }
    fn address(&self) -> usize {
        match self {
            Self::Owned(units) => Rc::as_ptr(units).cast::<()>() as usize,
            Self::Static(value) => core::ptr::from_ref(*value) as usize,
        }
    }
}

impl IContainer<Naive> for String {
    type Header = ();
    type Item = u16;
    type Items = Self;

    fn new<E>(_: (), i: impl IntoIterator<Item = Result<u16, E>>) -> Result<Self, E> {
        Ok(Self::Owned(i.into_iter().collect::<Result<_, _>>()?))
    }
    fn from_vec(_: (), items: Vec<u16>) -> Self {
        Self::Owned(items.into())
    }
    fn header(&self) -> &() {
        &()
    }
    fn items(&self) -> &Self {
        self
    }
}
