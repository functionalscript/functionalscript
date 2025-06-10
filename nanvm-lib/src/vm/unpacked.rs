use crate::{
    nullish::Nullish,
    vm::{internal::IInternalAny, Any, Array, BigInt, Function, Object, String},
};

#[derive(Clone)]
pub enum Unpacked<A: IInternalAny> {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
    String(String<A>),
    BigInt(BigInt<A>),
    Object(Object<A>),
    Array(Array<A>),
    Function(Function<A>),
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

impl<A: IInternalAny> From<String<A>> for Unpacked<A> {
    fn from(value: String<A>) -> Self {
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
