use super::Object;
use crate::vm::{IObject, IVm, Property};

pub trait ToObject {
    fn to_object<A: IVm>(self) -> Object<A>
    where
        Self: Sized + IntoIterator<Item = Property<A>>,
    {
        Object(A::InternalObject::from_properties(self))
    }
}

impl<T> ToObject for T {}
