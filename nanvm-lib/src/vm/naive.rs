use std::rc::Rc;

use crate::{
    sign::Sign,
    vm::{
        internal::{IContainer, IInternalAny},
        unpacked::Unpacked,
        Array, BigInt, Function, FunctionHeader, Object, Property, String,
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
    type String = InternalString;
    type BigInt = InternalBigInt;
    type Object = InternalObject;
    type Array = InternalArray;
    type Function = InternalFunction;

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

impl From<InternalString> for InternalAny {
    fn from(value: InternalString) -> Self {
        InternalAny(String(value).into())
    }
}

type InternalBigInt = Container<Sign, u64>;

impl From<InternalBigInt> for InternalAny {
    fn from(value: InternalBigInt) -> Self {
        InternalAny(BigInt(value).into())
    }
}

type InternalObject = Container<(), Property<InternalAny>>;

impl From<InternalObject> for InternalAny {
    fn from(value: InternalObject) -> Self {
        InternalAny(Object(value).into())
    }
}

type InternalArray = Container<(), super::Any<InternalAny>>;

impl From<InternalArray> for InternalAny {
    fn from(value: InternalArray) -> Self {
        InternalAny(Array(value).into())
    }
}

type InternalFunction = Container<FunctionHeader<InternalAny>, u8>;

impl From<InternalFunction> for InternalAny {
    fn from(value: InternalFunction) -> Self {
        InternalAny(Function(value).into())
    }
}
