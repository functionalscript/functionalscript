use super::String16;
use crate::vm::{internal::IContainer, IVm};

pub trait ToString16 {
    fn to_string16<A: IVm>(self) -> String16<A>
    where
        Self: Sized + IntoIterator<Item = u16>,
    {
        String16(A::InternalString16::new_ok((), self))
    }
}

impl<T> ToString16 for T {}
