use super::Object;
use crate::vm::{internal::IContainer, IVm, Property};

pub trait ToObject {
    fn to_object<A: IVm>(self) -> Object<A>
    where
        Self: Sized + IntoIterator<Item = Property<A>>,
    {
        Object(A::InternalObject::new_ok((), self))
    }
}

impl<T> ToObject for T {}
