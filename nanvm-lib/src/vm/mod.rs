mod any;
mod array;
mod bigint;
mod boolean_coercion;
mod container_fmt;
mod dispatch;
mod ecma_whitespace;
mod function;
mod impls;
mod int32_coercion;
mod internal;
mod join;
mod member_access;
mod nullish;
mod number_coercion;
mod numeric;
mod object;
mod primitive;
mod primitive_coercion;
mod string;
mod string_coercion;
mod unpacked;
pub mod unstable;

pub use crate::vm::{
    any::{Any, JsonError, to_any::ToAny},
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

    /// Compiles only: `Any<A>` is `PartialEq` for a generic VM. The two
    /// sides differ, a value and its clone, so clippy's `eq_op` does not
    /// read the comparison as a tautology under `--all-targets`.
    fn _eq_test<A: IVm>() {
        let x: Any<A> = 0.5.to_any();
        assert_eq!(x.clone(), x);
    }

    fn _any_test<A: IVm>() {
        let x: Any<A> = 0.5.to_any();
        let _: f64 = x.try_into().unwrap();
    }
}
