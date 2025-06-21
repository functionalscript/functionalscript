use crate::vm::{Any, IContainer, IInternalAny, String, Unpacked};
use std::fmt::{Debug, Formatter};

pub type FunctionHeader<A> = (String<A>, u32);

#[derive(Clone)]
pub struct Function<A: IInternalAny>(pub A::InternalFunction);

impl<A: IInternalAny> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for Function<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Function(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> Debug for Function<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        // TODO: name and source code.
        write!(f, "() => {{}}")
    }
}
