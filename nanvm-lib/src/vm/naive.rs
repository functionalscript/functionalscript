use std::{fmt::Debug, rc::Rc};

use crate::{
    sign::Sign,
    vm::{Any, FunctionHeader, IContainer, IInternalAny, Property, Unpacked},
};

#[derive(Clone)]
struct InternalAny(pub Unpacked<InternalAny>);

impl<T: Into<Unpacked<InternalAny>>> From<T> for InternalAny {
    fn from(value: T) -> Self {
        InternalAny(value.into())
    }
}

impl IInternalAny for InternalAny {
    type InternalString = Container<(), u16>;
    type InternalBigInt = Container<Sign, u64>;
    type InternalObject = Container<(), Property<InternalAny>>;
    type InternalArray = Container<(), Any<InternalAny>>;
    type InternalFunction = Container<FunctionHeader<InternalAny>, u8>;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }
}

#[derive(Clone, PartialEq)]
struct Container<H, I> {
    header: H,
    items: Rc<[I]>,
}

impl<H: Clone + PartialEq, I: Clone + Debug> IContainer<InternalAny> for Container<H, I> {
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

    fn len(&self) -> usize {
        self.items.len()
    }

    fn at(&self, i: usize) -> Self::Item {
        self.items[i].clone()
    }

    fn ptr_eq(&self, other: &Self) -> bool {
        self.header == other.header && Rc::ptr_eq(&self.items, &other.items)
    }
}
