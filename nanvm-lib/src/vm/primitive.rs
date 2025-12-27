use crate::{
    nullish::Nullish,
    vm::{BigInt, IVm, String, Unpacked},
};

/// <https://developer.mozilla.org/en-US/docs/Glossary/Primitive>
/// A primitive value is a subset of Unpacked that excludes Object, Array, and Function.
#[allow(dead_code)]
#[derive(Debug, PartialEq, Clone)]
pub enum Primitive<A: IVm> {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
    String(String<A>),
    BigInt(BigInt<A>),
}

impl<A: IVm> From<Primitive<A>> for Unpacked<A> {
    fn from(value: Primitive<A>) -> Self {
        match value {
            Primitive::Nullish(n) => Unpacked::Nullish(n),
            Primitive::Boolean(b) => Unpacked::Boolean(b),
            Primitive::Number(n) => Unpacked::Number(n),
            Primitive::String(s) => Unpacked::String(s),
            Primitive::BigInt(i) => Unpacked::BigInt(i),
        }
    }
}
