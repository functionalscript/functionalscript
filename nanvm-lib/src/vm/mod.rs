pub mod any;
pub mod array;
pub mod bigint;
pub mod function;
pub mod internal;
pub mod naive;
pub mod object;
pub mod string16;
pub mod unpacked;
pub mod to_string16;

pub use crate::vm::{
    any::{Any, ToAnyEx},
    array::Array,
    bigint::BigInt,
    function::{Function, FunctionHeader},
    internal::{IContainer, IInternalAny},
    object::{Object, Property},
    string16::String16,
    unpacked::Unpacked,
    to_string16::ToString16,
};

#[cfg(test)]
mod test {
    use super::*;

    fn _eq_test<A: IInternalAny>() {
        let x: Any<A> = 0.5.to_any();
        assert_eq!(x, x);
    }

    fn _any_test<A: IInternalAny>() {
        let x: Any<A> = 0.5.to_any();
        let _: f64 = x.try_into().unwrap();
    }
}
