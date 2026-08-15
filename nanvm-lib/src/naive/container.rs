use core::fmt::Debug;
use std::rc::Rc;

use crate::{naive::Naive, vm::IContainer};

#[derive(Clone, PartialEq)]
pub struct Container<H, I> {
    header: H,
    items: Rc<[I]>,
}

impl<H: Clone + PartialEq + 'static, I: Clone + Debug + 'static> IContainer<Naive>
    for Container<H, I>
{
    type Header = H;
    type Item = I;
    type Items = [I];

    fn new<E>(
        header: Self::Header,
        i: impl IntoIterator<Item = Result<Self::Item, E>>,
    ) -> Result<Self, E> {
        Ok(Self {
            header,
            items: i.into_iter().collect::<Result<_, _>>()?,
        })
    }

    fn header(&self) -> &Self::Header {
        &self.header
    }

    fn items(&self) -> &Self::Items {
        self.items.as_ref()
    }

    fn ptr_eq(&self, other: &Self) -> bool {
        self.header == other.header && Rc::ptr_eq(&self.items, &other.items)
    }
}
