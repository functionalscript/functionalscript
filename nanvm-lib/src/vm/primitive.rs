use crate::{
    nullish::Nullish,
    vm::{BigInt, IVm, String},
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
