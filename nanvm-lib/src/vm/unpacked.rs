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
