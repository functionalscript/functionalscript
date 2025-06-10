use crate::{
    nullish::Nullish,
    vm::{internal::Internal, Any, Array, BigInt, Function, Object, String},
};

#[derive(Clone)]
pub enum Unpacked<A: Internal> {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
    String(String<A>),
    BigInt(BigInt<A>),
    Object(Object<A>),
    Array(Array<A>),
    Function(Function<A>),
}

impl<A: Internal> From<Any<A>> for Unpacked<A> {
    fn from(value: Any<A>) -> Self {
        value.0.to_unpacked()
    }
}
