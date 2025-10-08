mod any;
mod array;
mod bigint;
mod function;
mod internal;
mod number;
mod object;
mod string16;
mod string_coercion;
mod unpacked;

pub mod naive;

pub use crate::vm::{
    any::{Any, ToAny},
    array::{Array, ToArray},
    bigint::BigInt,
    function::{Function, FunctionHeader},
    internal::{IContainer, IVm},
    object::{Object, Property, ToObject},
    string16::String16,
    string_coercion::StringCoercion,
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
