use crate::vm::internal::{IContainer, IInternalAny};

#[derive(Clone)]
pub struct String<A: IInternalAny>(pub A::InternalString);

impl<A: IInternalAny> PartialEq for String<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.deep_eq(&other.0)
    }
}
