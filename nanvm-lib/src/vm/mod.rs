pub mod any;
pub mod array;
pub mod bigint;
pub mod function;
pub mod internal;
pub mod naive;
pub mod number;
pub mod object;
pub mod string16;
pub mod string_coercion;
pub mod unpacked;

pub use crate::vm::{
    any::Any,
    array::Array,
    bigint::BigInt,
    function::{Function, FunctionHeader},
    internal::{IContainer, IVm},
    object::{Object, Property},
    string16::String16,
    unpacked::Unpacked,
};

#[cfg(test)]
mod test {
    use crate::vm::any::ToAny;

    use super::*;

    fn _eq_test<A: IVm>() {
        let x: Any<A> = 0.5.to_any();
        assert_eq!(x, x);
    }

    fn _any_test<A: IVm>() {
        let x: Any<A> = 0.5.to_any();
        let _: f64 = x.try_into().unwrap();
    }
}
