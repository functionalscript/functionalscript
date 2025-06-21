use crate::vm::{Any, IContainer, IInternalAny, String, Unpacked};
use std::fmt::{Debug, Formatter};

pub type Property<A> = (String<A>, Any<A>);

#[derive(Clone)]
pub struct Object<A: IInternalAny>(pub A::InternalObject);

impl<A: IInternalAny> PartialEq for Object<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for Object<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Object(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> Debug for Object<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{{")?;
        let mut first = true;
        for i in 0..self.0.len() {
            if !first {
                write!(f, ",")?;
            }
            write!(f, "{:?}", self.0.at(i))?;
            first = false;
        }
        write!(f, "}}")
    }
}
