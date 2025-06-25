use std::{fmt::Debug, rc::Rc};

use crate::{
    common::serializable::Serializable,
    sign::Sign,
    vm::{Any, FunctionHeader, IContainer, IVm, Property, Unpacked},
};

#[derive(Clone)]
pub struct InternalAny(pub Unpacked<InternalAny>);

impl<T: Into<Unpacked<InternalAny>>> From<T> for InternalAny {
    fn from(value: T) -> Self {
        InternalAny(value.into())
    }
}

impl IVm for InternalAny {
    type InternalString16 = Container<(), u16>;
    type InternalBigInt = Container<Sign, u64>;
    type InternalObject = Container<(), Property<InternalAny>>;
    type InternalArray = Container<(), Any<InternalAny>>;
    type InternalFunction = Container<FunctionHeader<InternalAny>, u8>;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }
}

#[derive(Clone, PartialEq)]
pub struct Container<H, I> {
    header: H,
    items: Rc<[I]>,
}

impl<H: Clone + PartialEq + Serializable, I: Clone + Debug + Serializable> IContainer<InternalAny>
    for Container<H, I>
{
    type Header = H;
    type Item = I;

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

    fn len(&self) -> u32 {
        self.items.len() as u32
    }

    fn at(&self, i: u32) -> Self::Item {
        self.items[i as usize].clone()
    }

    fn ptr_eq(&self, other: &Self) -> bool {
        self.header == other.header && Rc::ptr_eq(&self.items, &other.items)
    }
}
