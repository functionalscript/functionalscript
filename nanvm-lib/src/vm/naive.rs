use std::rc::Rc;

use crate::{
    sign::Sign,
    vm::{
        internal::{IContainer, IInternalAny, ISimple},
        unpacked::Unpacked,
        Array, BigInt, Function, FunctionHeader, Object, Property, String,
    },
};

#[derive(Clone)]
struct InternalAny(pub Unpacked<InternalAny>);

impl<T: Into<Unpacked<InternalAny>>> ISimple<InternalAny, T> for InternalAny {
    fn to_internal(value: T) -> Self {
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

impl ISimple<InternalAny, InternalString> for InternalAny {
    fn to_internal(value: InternalString) -> InternalAny {
        InternalAny(Unpacked::String(String(value)))
    }
}

type InternalBigInt = Container<Sign, u64>;

impl ISimple<InternalAny, InternalBigInt> for InternalAny {
    fn to_internal(value: InternalBigInt) -> InternalAny {
        InternalAny(Unpacked::BigInt(BigInt(value)))
    }
}

type InternalObject = Container<(), Property<InternalAny>>;

impl ISimple<InternalAny, InternalObject> for InternalAny {
    fn to_internal(value: InternalObject) -> InternalAny {
        InternalAny(Unpacked::Object(Object(value)))
    }
}

type InternalArray = Container<(), super::Any<InternalAny>>;

impl ISimple<InternalAny, InternalArray> for InternalAny {
    fn to_internal(value: InternalArray) -> InternalAny {
        InternalAny(Unpacked::Array(Array(value)))
    }
}

type InternalFunction = Container<FunctionHeader<InternalAny>, u8>;

impl ISimple<InternalAny, InternalFunction> for InternalAny {
    fn to_internal(value: InternalFunction) -> InternalAny {
        InternalAny(Unpacked::Function(Function(value)))
    }
}
