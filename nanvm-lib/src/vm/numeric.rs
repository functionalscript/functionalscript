use crate::vm::{BigInt, IVm};

/// <https://tc39.es/ecma262/#sec-tonumeric>
/// A primitive value is a subset of Unpacked that excludes Object, Array, and Function.
#[allow(dead_code)]
#[derive(Debug, PartialEq, Clone)]
pub enum Numeric<A: IVm> {
    Number(f64),
    BigInt(BigInt<A>),
}
