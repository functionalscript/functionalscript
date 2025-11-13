use crate::vm::{IVm, internal::IContainer};
use super::Object;

impl<A: IVm> Default for Object<A> {
    fn default() -> Self {
        Object(A::InternalObject::new_empty(()))
    }
}
