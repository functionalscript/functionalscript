use crate::{
    nullish::Nullish,
    vm::{Any, Array, BigInt, Function, IInternalAny, Js, Object, String16},
};
use std::fmt::Debug;

#[derive(Clone)]
pub enum Unpacked<A: IInternalAny> {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
    String(String16<A>),
    BigInt(BigInt<A>),
    Object(Object<A>),
    Array(Array<A>),
    Function(Function<A>),
}

impl<A: IInternalAny> Debug for Unpacked<A> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Nullish(x) => x.fmt(f),
            Self::Boolean(x) => x.fmt(f),
            Self::Number(x) => x.fmt(f),
            Self::String(x) => x.fmt(f),
            Self::BigInt(x) => x.fmt(f),
            Self::Object(x) => x.fmt(f),
            Self::Array(x) => x.fmt(f),
            Self::Function(x) => x.fmt(f),
        }
    }
}

impl<A: IInternalAny> Js<A> for Unpacked<A> {
    fn string(&self) -> String16<A> {
        match self {
            Self::Nullish(n) => n.string(),
            Self::Boolean(b) => b.string(),
            Self::Number(n) => n.string(),
            Self::String(s) => s.string(),
            Self::BigInt(i) => i.string(),
            Self::Object(o) => o.string(),
            Self::Array(a) => a.string(),
            Self::Function(f) => f.string(),
        }
    }
}

impl<A: IInternalAny> PartialEq for Unpacked<A> {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Nullish(a), Self::Nullish(b)) => a == b,
            (Self::Boolean(a), Self::Boolean(b)) => a == b,
            (Self::Number(a), Self::Number(b)) => a == b,
            (Self::String(a), Self::String(b)) => a == b,
            (Self::BigInt(a), Self::BigInt(b)) => a == b,
            (Self::Object(a), Self::Object(b)) => a == b,
            (Self::Array(a), Self::Array(b)) => a == b,
            (Self::Function(a), Self::Function(b)) => a == b,
            _ => false,
        }
    }
}

impl<A: IInternalAny> From<Any<A>> for Unpacked<A> {
    fn from(value: Any<A>) -> Self {
        value.0.to_unpacked()
    }
}

impl<A: IInternalAny> From<Nullish> for Unpacked<A> {
    fn from(value: Nullish) -> Self {
        Unpacked::Nullish(value)
    }
}

impl<A: IInternalAny> From<bool> for Unpacked<A> {
    fn from(value: bool) -> Self {
        Unpacked::Boolean(value)
    }
}
impl<A: IInternalAny> From<f64> for Unpacked<A> {
    fn from(value: f64) -> Self {
        Unpacked::Number(value)
    }
}

impl<A: IInternalAny> From<String16<A>> for Unpacked<A> {
    fn from(value: String16<A>) -> Self {
        Unpacked::String(value)
    }
}

impl<A: IInternalAny> From<BigInt<A>> for Unpacked<A> {
    fn from(value: BigInt<A>) -> Self {
        Unpacked::BigInt(value)
    }
}

impl<A: IInternalAny> From<Object<A>> for Unpacked<A> {
    fn from(value: Object<A>) -> Self {
        Unpacked::Object(value)
    }
}

impl<A: IInternalAny> From<Array<A>> for Unpacked<A> {
    fn from(value: Array<A>) -> Self {
        Unpacked::Array(value)
    }
}

impl<A: IInternalAny> From<Function<A>> for Unpacked<A> {
    fn from(value: Function<A>) -> Self {
        Unpacked::Function(value)
    }
}
