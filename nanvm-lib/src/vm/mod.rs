pub mod internal;
pub mod naive;
pub mod unpacked;

use crate::{
    nullish::Nullish,
    vm::{
        internal::{IComplex, IInternalAny},
        unpacked::Unpacked,
    },
};

#[derive(Clone)]
pub struct Any<A: IInternalAny>(pub A);

impl<A: IInternalAny> From<Nullish> for Any<A> {
    fn from(value: Nullish) -> Self {
        A::to_any(value)
    }
}

impl<A: IInternalAny> From<bool> for Any<A> {
    fn from(value: bool) -> Self {
        A::to_any(value)
    }
}

impl<A: IInternalAny> From<f64> for Any<A> {
    fn from(value: f64) -> Self {
        A::to_any(value)
    }
}

impl<A: IInternalAny> From<String<A>> for Any<A> {
    fn from(value: String<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: IInternalAny> From<BigInt<A>> for Any<A> {
    fn from(value: BigInt<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: IInternalAny> From<Object<A>> for Any<A> {
    fn from(value: Object<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: IInternalAny> From<Array<A>> for Any<A> {
    fn from(value: Array<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: IInternalAny> From<Function<A>> for Any<A> {
    fn from(value: Function<A>) -> Self {
        value.0.to_any()
    }
}

impl<A: IInternalAny> From<Unpacked<A>> for Any<A> {
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

#[derive(Clone)]
pub struct String<A: IInternalAny>(pub A::String);

#[derive(Clone)]
pub struct BigInt<A: IInternalAny>(pub A::BigInt);

pub type Property<A> = (String<A>, Any<A>);

#[derive(Clone)]
pub struct Object<A: IInternalAny>(pub A::Object);

#[derive(Clone)]
pub struct Array<A: IInternalAny>(pub A::Array);

pub type FunctionHeader<A> = (String<A>, u32);

#[derive(Clone)]
pub struct Function<A: IInternalAny>(pub A::Function);

