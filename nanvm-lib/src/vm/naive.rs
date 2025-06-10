use std::rc::Rc;

use crate::{
    nullish::Nullish,
    sign::Sign,
    vm::{internal, unpacked::Unpacked, Property},
};

#[derive(Clone)]
struct Any(pub Unpacked<Any>);

impl internal::Simple<Any, Nullish> for Any {
    fn to_internal(value: Nullish) -> Self {
        Any(Unpacked::Nullish(value))
    }
}

impl internal::Simple<Any, bool> for Any {
    fn to_internal(value: bool) -> Self {
        Any(Unpacked::Boolean(value))
    }
}

impl internal::Simple<Any, f64> for Any {
    fn to_internal(value: f64) -> Self {
        Any(Unpacked::Number(value))
    }
}

impl internal::Internal for Any {
    type String = String;
    type BigInt = BigInt;
    type Object = Object;
    type Array = Array;
    type Function = Function;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }
}

#[derive(Clone)]
struct Container<H, I> {
    header: H,
    items: Rc<[I]>,
}

impl<H: Clone, I: Clone> internal::Container<Any> for Container<H, I> {
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

type String = Container<(), u16>;

impl internal::Complex<Any> for String {
    fn to_internal(self) -> Any {
        Any(Unpacked::String(super::String(self)))
    }
}

impl internal::String<Any> for String {}

type BigInt = Container<Sign, u64>;

impl internal::BigInt<Any> for BigInt {}

impl internal::Complex<Any> for BigInt {
    fn to_internal(self) -> Any {
        Any(Unpacked::BigInt(super::BigInt(self)))
    }
}

type Object = Container<(), Property<Any>>;

impl internal::Object<Any> for Object {}

impl internal::Complex<Any> for Object {
    fn to_internal(self) -> Any {
        Any(Unpacked::Object(super::Object(self)))
    }
}

type Array = Container<(), super::Any<Any>>;

impl internal::Array<Any> for Array {}

impl internal::Complex<Any> for Array {
    fn to_internal(self) -> Any {
        Any(Unpacked::Array(super::Array(self)))
    }
}

type Function = Container<internal::FunctionHeader<Any>, u8>;

impl internal::Function<Any> for Function {}

impl internal::Complex<Any> for Function {
    fn to_internal(self) -> Any {
        Any(Unpacked::Function(super::Function(self)))
    }
}
