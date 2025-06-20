pub mod any;
pub mod array;
pub mod bigint;
pub mod function;
pub mod internal;
pub mod naive;
pub mod object;
pub mod string;
pub mod unpacked;

pub use crate::vm::{
    any::Any,
    array::Array,
    bigint::BigInt,
    function::{Function, FunctionHeader},
    internal::{IContainer, IInternalAny},
    object::{Object, Property},
    string::String,
    unpacked::Unpacked,
};

#[cfg(test)]
mod test {
    use crate::vm::{any::AnyEx, internal::IInternalAny, Any};

    fn _eq_test<A: IInternalAny>() {
        let x: Any<A> = 0.5.to_any();
        let _ = x == x;
    }
}
