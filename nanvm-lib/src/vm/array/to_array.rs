use super::Array;
use crate::vm::{Any, IVm, internal::IContainer};

pub trait ToArray {
    fn to_array<A: IVm>(self) -> Array<A>
    where
        Self: Sized + IntoIterator<Item = Any<A>>,
    {
        Array(A::InternalArray::new_ok((), self))
    }
}

impl<T> ToArray for T {}
