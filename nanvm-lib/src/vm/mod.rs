pub mod any;
pub mod bigint;
pub mod internal;
pub mod naive;
pub mod object;
pub mod string;
pub mod unpacked;

use crate::vm::{
    any::Any,
    internal::{IContainer, IInternalAny},
    string::String,
    unpacked::Unpacked,
};

#[derive(Clone)]
pub struct Array<A: IInternalAny>(pub A::InternalArray);

impl<A: IInternalAny> PartialEq for Array<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

pub type FunctionHeader<A> = (String<A>, u32);

#[derive(Clone)]
pub struct Function<A: IInternalAny>(pub A::InternalFunction);

impl<A: IInternalAny> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

#[cfg(test)]
mod test {
    use crate::vm::{any::AnyEx, internal::IInternalAny, Any};

    fn _eq_test<A: IInternalAny>() {
        let x: Any<A> = 0.5.to_any();
        let _ = x == x;
    }
}
