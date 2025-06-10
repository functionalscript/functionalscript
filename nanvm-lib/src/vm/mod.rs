use crate::{nullish::Nullish, vm::{internal::{Container, Internal}, unpacked::Unpacked}};

pub mod internal;
pub mod unpacked;

pub struct Any<A: Internal>(pub A);

impl<A: Internal> From<Nullish> for Any<A> {
    fn from(value: Nullish) -> Self {
        A::to_any(value)
    }
}

impl<A: Internal> From<bool> for Any<A> {
    fn from(value: bool) -> Self {
        A::to_any(value)
    }
}

impl<A: Internal> From<f64> for Any<A> {
    fn from(value: f64) -> Self {
        A::to_any(value)
    }
}

impl<A: Internal> From<String<A>> for Any<A> {
    fn from(value: String<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: Internal> From<BigInt<A>> for Any<A> {
    fn from(value: BigInt<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: Internal> From<Object<A>> for Any<A> {
    fn from(value: Object<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: Internal> From<Array<A>> for Any<A> {
    fn from(value: Array<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: Internal> From<Function<A>> for Any<A> {
    fn from(value: Function<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: Internal> From<Unpacked<A>> for Any<A> {
    fn from(value: Unpacked<A>) -> Self {
        match value {
            Unpacked::Nullish(n) => n.into(),
            Unpacked::Boolean(b) => b.into(),
            Unpacked::Number(n) => n.into(),
            Unpacked::String(s) => s.into(),
            Unpacked::BigInt(i) => i.into(),
            Unpacked::Object(o) => o.into(),
            Unpacked::Array(a) => a.into(),
            Unpacked::Function(f) => f.into(),
        }
    }
}

pub struct String<A: Internal>(pub A::String);

pub struct BigInt<A: Internal>(pub A::BigInt);

pub struct Object<A: Internal>(pub A::Object);

pub struct Array<A: Internal>(pub A::Array);

pub struct Function<A: Internal>(pub A::Function);

pub type Property<A> = (String<A>, Any<A>);
