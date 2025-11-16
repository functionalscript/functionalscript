mod add;
mod add_assign;
mod any;
mod array;
mod bigint;
mod container_fmt;
mod container_iterator;
mod debug;
mod default;
mod dispatch;
mod from;
mod function;
mod internal;
mod into_iterator;
mod join;
mod number_coercion;
mod object;
mod partial_eq;
mod primitive;
mod primitive_coercion;
mod serializable;
mod string16;
mod string_coercion;
mod try_from;
mod unpacked;

pub mod naive;

pub use crate::vm::{
    any::{to_any::ToAny, Any},
    array::{to_array::ToArray, Array},
    bigint::BigInt,
    function::{header::FunctionHeader, Function},
    internal::{IContainer, IVm},
    object::{property::Property, to_object::ToObject, Object},
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
