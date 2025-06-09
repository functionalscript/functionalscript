use crate::{nullish::Nullish, vm::internal::Container};

pub mod internal;

pub enum Unpacked<T: internal::Any> {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
    String(String<T>),
    BigInt(BigInt<T>),
    Object(Object<T>),
    Array(Array<T>),
}

impl<T: internal::Any> From<Any<T>> for Unpacked<T> {
    fn from(value: Any<T>) -> Self {
        value.0.unpack()
    }
}

pub struct Any<T: internal::Any>(pub T);

impl<T: internal::Any> From<Nullish> for Any<T> {
    fn from(value: Nullish) -> Self {
        T::to_any(value)
    }
}

impl<T: internal::Any> From<bool> for Any<T> {
    fn from(value: bool) -> Self {
        T::to_any(value)
    }
}

impl<T: internal::Any> From<f64> for Any<T> {
    fn from(value: f64) -> Self {
        T::to_any(value)
    }
}

impl<T: internal::Any> From<String<T>> for Any<T> {
    fn from(value: String<T>) -> Self {
        value.0.to_any()
    }
}

impl<T: internal::Any> From<BigInt<T>> for Any<T> {
    fn from(value: BigInt<T>) -> Self {
        value.0.to_any()
    }
}

impl<T: internal::Any> From<Object<T>> for Any<T> {
    fn from(value: Object<T>) -> Self {
        value.0.to_any()
    }
}

impl<T: internal::Any> From<Array<T>> for Any<T> {
    fn from(value: Array<T>) -> Self {
        value.0.to_any()
    }
}

impl<T: internal::Any> From<Unpacked<T>> for Any<T> {
    fn from(value: Unpacked<T>) -> Self {
        match value {
            Unpacked::Nullish(n) => n.into(),
            Unpacked::Boolean(b) => b.into(),
            Unpacked::Number(n) => n.into(),
            Unpacked::String(s) => s.into(),
            Unpacked::BigInt(i) => i.into(),
            Unpacked::Object(o) => o.into(),
            Unpacked::Array(a) => a.into(),
        }
    }
}

pub struct String<T: internal::Any>(pub T::String);

pub struct BigInt<T: internal::Any>(pub T::BigInt);

pub struct Object<T: internal::Any>(pub T::Object);

pub struct Array<T: internal::Any>(pub T::Array);

pub type Property<T> = (String<T>, Any<T>);
