use crate::vm::{
    any::Any,
    internal::{IContainer, IInternalAny},
    string::String,
};

pub type Property<A> = (String<A>, Any<A>);

#[derive(Clone)]
pub struct Object<A: IInternalAny>(pub A::InternalObject);

impl<A: IInternalAny> PartialEq for Object<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}
