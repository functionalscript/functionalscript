use std::rc::Rc;

use crate::{
    sign::Sign,
    vm::{
        internal::{IContainer, IInternalAny},
        unpacked::Unpacked,
        Array, BigInt, Function, FunctionHeader, Object, Property
    },
};

#[derive(Clone)]
struct InternalAny(pub Unpacked<InternalAny>);

impl<T: Into<Unpacked<InternalAny>>> From<T> for InternalAny {
    fn from(value: T) -> Self {
        InternalAny(value.into())
    }
}

impl IInternalAny for InternalAny {
    type InternalString = InternalString;
    type InternalBigInt = InternalBigInt;
    type InternalObject = InternalObject;
    type InternalArray = InternalArray;
    type InternalFunction = InternalFunction;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }
}

#[derive(Clone)]
struct Container<H, I> {
    header: H,
    items: Rc<[I]>,
}

impl<H: Clone, I: Clone> IContainer<InternalAny> for Container<H, I>
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

    fn len(&self) -> usize {
        self.items.len()
    }

    fn at(&self, i: usize) -> Self::Item {
        self.items[i].clone()
    }
}

type InternalString = Container<(), u16>;

type InternalBigInt = Container<Sign, u64>;

type InternalObject = Container<(), Property<InternalAny>>;

type InternalArray = Container<(), super::Any<InternalAny>>;

type InternalFunction = Container<FunctionHeader<InternalAny>, u8>;
