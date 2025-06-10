use std::rc::Rc;

use crate::{
    nullish::Nullish,
    sign::Sign,
    vm::{
        internal::{IComplex, IContainer, IInternalAny, ISimple},
        unpacked::Unpacked,
        Array, BigInt, Function, FunctionHeader, Object, Property, String,
    },
};

#[derive(Clone)]
struct InternalAny(pub Unpacked<InternalAny>);

impl ISimple<InternalAny, Nullish> for InternalAny {
    fn to_internal(value: Nullish) -> Self {
        InternalAny(Unpacked::Nullish(value))
    }
}

impl ISimple<InternalAny, bool> for InternalAny {
    fn to_internal(value: bool) -> Self {
        InternalAny(Unpacked::Boolean(value))
    }
}

impl ISimple<InternalAny, f64> for InternalAny {
    fn to_internal(value: f64) -> Self {
        InternalAny(Unpacked::Number(value))
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

impl<H: Clone, I: Clone> IContainer<InternalAny> for Container<H, I> {
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

impl IComplex<InternalAny> for InternalString {
    fn to_internal(self) -> InternalAny {
        InternalAny(Unpacked::String(String(self)))
    }
}

type InternalBigInt = Container<Sign, u64>;

impl IComplex<InternalAny> for InternalBigInt {
    fn to_internal(self) -> InternalAny {
        InternalAny(Unpacked::BigInt(BigInt(self)))
    }
}

type InternalObject = Container<(), Property<InternalAny>>;

impl IComplex<InternalAny> for InternalObject {
    fn to_internal(self) -> InternalAny {
        InternalAny(Unpacked::Object(Object(self)))
    }
}

type InternalArray = Container<(), super::Any<InternalAny>>;

impl IComplex<InternalAny> for InternalArray {
    fn to_internal(self) -> InternalAny {
        InternalAny(Unpacked::Array(Array(self)))
    }
}

type InternalFunction = Container<FunctionHeader<InternalAny>, u8>;

impl IComplex<InternalAny> for InternalFunction {
    fn to_internal(self) -> InternalAny {
        InternalAny(Unpacked::Function(Function(self)))
    }
}
