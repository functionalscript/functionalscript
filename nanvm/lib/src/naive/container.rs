use core::{cell::OnceCell, fmt::Debug};
use std::rc::Rc;

use crate::{
    naive::Naive,
    vm::{Any, IComplex, IContainer, StaticArray},
};

/// Runtime indexing lends a reference to a VM value. Materialize the immediate
/// children on first access so loading a descriptor never walks its whole graph.
trait Project<I> {
    fn project(&self) -> Box<[I]>;
}

impl Project<Any<Naive>> for StaticArray<Naive> {
    fn project(&self) -> Box<[Any<Naive>]> {
        self.0.iter().map(|item| item.load()).collect()
    }
}

#[derive(Clone)]
enum Items<I: 'static> {
    Owned(Rc<[I]>),
    Borrowed {
        items: &'static [I],
        address: usize,
    },
    Projected {
        source: &'static dyn Project<I>,
        items: Rc<OnceCell<Box<[I]>>>,
    },
}

#[derive(Clone)]
pub struct Container<H, I: 'static> {
    header: H,
    items: Items<I>,
}

impl<H, I> Container<H, I> {
    pub(super) fn borrowed<D>(header: H, descriptor: &'static D, items: &'static [I]) -> Self {
        Self {
            header,
            items: Items::Borrowed {
                items,
                address: core::ptr::from_ref(descriptor) as usize,
            },
        }
    }
    fn projected(header: H, source: &'static dyn Project<I>) -> Self {
        Self {
            header,
            items: Items::Projected {
                source,
                items: Rc::default(),
            },
        }
    }
}

impl Container<(), Any<Naive>> {
    pub(super) fn array(value: &'static StaticArray<Naive>) -> Self {
        if value.0.is_empty() {
            Self::borrowed((), value, &[])
        } else {
            Self::projected((), value)
        }
    }
}

impl<H: Clone + PartialEq, I: Clone + Debug> IComplex<Naive> for Container<H, I> {
    fn ptr_eq(&self, other: &Self) -> bool {
        self.header == other.header && self.address() == other.address()
    }
    fn address(&self) -> usize {
        match &self.items {
            Items::Owned(items) => Rc::as_ptr(items).cast::<()>() as usize,
            Items::Borrowed { address, .. } => *address,
            Items::Projected { source, .. } => core::ptr::from_ref(*source).cast::<()>() as usize,
        }
    }
}

impl<H: Clone + PartialEq, I: Clone + Debug> IContainer<Naive> for Container<H, I> {
    type Header = H;
    type Item = I;
    type Items = [I];

    fn new<E>(header: H, i: impl IntoIterator<Item = Result<I, E>>) -> Result<Self, E> {
        Ok(Self {
            header,
            items: Items::Owned(i.into_iter().collect::<Result<_, _>>()?),
        })
    }
    fn from_vec(header: H, items: Vec<I>) -> Self {
        Self {
            header,
            items: Items::Owned(items.into()),
        }
    }
    fn header(&self) -> &H {
        &self.header
    }
    fn items(&self) -> &[I] {
        match &self.items {
            Items::Owned(items) => items,
            Items::Borrowed { items, .. } => items,
            Items::Projected { source, items } => items.get_or_init(|| source.project()),
        }
    }
}
