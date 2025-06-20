use crate::vm::{IContainer, IInternalAny};

#[derive(Clone)]
pub struct Array<A: IInternalAny>(pub A::InternalArray);

impl<A: IInternalAny> PartialEq for Array<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}
