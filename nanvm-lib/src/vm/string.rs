use crate::vm::{Any, IContainer, IInternalAny, Unpacked};
use std::fmt::{Debug, Formatter};

#[derive(Clone)]
pub struct String<A: IInternalAny>(pub A::InternalString);

impl<A: IInternalAny> PartialEq for String<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.deep_eq(&other.0)
    }
}

impl<A: IInternalAny> Debug for String<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let r = std::string::String::from_utf16(&self.0.collect())
            .map_err(|_| std::fmt::Error)?;
        // TODO: escape special characters
        write!(f, "\"{}\"", r)
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for String<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::String(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}
