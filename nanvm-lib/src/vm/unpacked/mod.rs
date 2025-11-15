mod from;
mod partial_eq;
mod serializable;

pub mod dispatch;

use crate::{
    nullish::Nullish,
    vm::{unpacked::dispatch::Dispatch, Array, BigInt, Function, IVm, Object, String16},
};

#[derive(Clone)]
pub enum Unpacked<A: IVm> {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
    String(String16<A>),
    BigInt(BigInt<A>),
    Object(Object<A>),
    Array(Array<A>),
    Function(Function<A>),
}

impl<A: IVm> Unpacked<A> {
    pub fn dispatch<T: Dispatch<A>>(self, o: T) -> T::Result {
        match self {
            Unpacked::Nullish(v) => o.nullish(v),
            Unpacked::Boolean(v) => o.bool(v),
            Unpacked::Number(v) => o.number(v),
            Unpacked::String(v) => o.string(v),
            Unpacked::BigInt(v) => o.bigint(v),
            Unpacked::Object(v) => o.object(v),
            Unpacked::Array(v) => o.array(v),
            Unpacked::Function(v) => o.function(v),
        }
    }
}
