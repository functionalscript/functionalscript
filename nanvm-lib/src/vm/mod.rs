mod any;
mod array;
mod bigint;
mod container_fmt;
mod dispatch;
mod function;
mod impls;
mod internal;
mod join;
mod nullish;
mod number_coercion;
mod numeric;
mod object;
mod primitive;
mod primitive_coercion;
mod string;
mod string_coercion;
mod unpacked;

pub use crate::vm::{
    any::{Any, to_any::ToAny},
    array::{Array, to_array::ToArray},
    bigint::BigInt,
    function::{Function, header::FunctionHeader},
    internal::{IContainer, IVm},
    nullish::Nullish,
    object::{Object, property::Property, to_object::ToObject},
    string::{String, to_string::ToString},
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
