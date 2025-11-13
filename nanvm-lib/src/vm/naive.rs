use core::fmt::Debug;
use std::rc::Rc;

use crate::{
    common::serializable::Serializable,
    sign::Sign,
    vm::{Any, FunctionHeader, IContainer, IVm, Property, Unpacked},
};

/// Note: we can't use `type InternalAny = Unpacked<InternalAny>;` because Rust doesn't support
/// recursive type aliases.
#[derive(Clone)]
pub struct Naive(pub(crate) Unpacked<Naive>);

impl IVm for Naive {
    type InternalString16 = Container<(), u16>;
    type InternalBigInt = Container<Sign, u64>;
    type InternalObject = Container<(), Property<Naive>>;
    type InternalArray = Container<(), Any<Naive>>;
    type InternalFunction = Container<FunctionHeader<Naive>, u8>;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }
}

#[derive(Clone, PartialEq)]
pub struct Container<H, I> {
    header: H,
    items: Rc<[I]>,
}

impl<H: Clone + PartialEq + Serializable + 'static, I: Clone + Debug + Serializable + 'static>
    IContainer<Naive> for Container<H, I>
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
