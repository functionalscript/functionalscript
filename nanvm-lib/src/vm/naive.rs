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

    fn items(&self, i: usize) -> Self::Item {
        self.items[i].clone()
    }

    fn to_internal(self) -> Any {
        todo!()
    }
}

type String = Container<(), u16>;

impl internal::String<Any> for String {}

type BigInt = Container<Sign, u64>;

impl internal::BigInt<Any> for BigInt {}

type Object = Container<(), Property<Any>>;

impl internal::Object<Any> for Object {}

type Array = Container<(), super::Any<Any>>;

impl internal::Array<Any> for Array {}

type Function = Container<internal::FunctionHeader<Any>, u8>;

impl internal::Function<Any> for Function {}
