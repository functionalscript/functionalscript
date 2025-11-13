mod any;
mod array;
mod bigint;
mod function;
mod internal;
mod number_coercion;
mod object;
mod primitive;
mod primitive_coercion;
mod string16;
mod string_coercion;
mod unpacked;

pub mod naive;

pub use crate::vm::{
    any::{to_any::ToAny, Any},
    array::{to_array::ToArray, Array},
    bigint::BigInt,
    function::{Function, FunctionHeader},
    internal::{IContainer, IVm},
    object::{to_object::ToObject, Object, Property},
    string16::{to_string16::ToString16, String16},
    unpacked::Unpacked,
};

#[cfg(test)]
mod test {
    use crate::vm::ToAny;

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
