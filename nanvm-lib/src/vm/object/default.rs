use super::Object;
use crate::vm::{internal::IContainer, IVm};

impl<A: IVm> Default for Object<A> {
    fn default() -> Self {
        Object(A::InternalObject::new_empty(()))
    }
}
