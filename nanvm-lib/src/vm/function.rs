use crate::vm::{IContainer, IInternalAny, String};

pub type FunctionHeader<A> = (String<A>, u32);

#[derive(Clone)]
pub struct Function<A: IInternalAny>(pub A::InternalFunction);

impl<A: IInternalAny> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}
