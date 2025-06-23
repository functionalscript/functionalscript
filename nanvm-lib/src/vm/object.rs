use crate::vm::{Any, IContainer, IInternalAny, String16, ToString16, Unpacked};
use std::fmt::{Debug, Formatter};

pub type Property<A> = (String16<A>, Any<A>);

#[derive(Clone)]
pub struct Object<A: IInternalAny>(pub A::InternalObject);

impl<A: IInternalAny> Default for Object<A> {
    fn default() -> Self {
        Object(A::InternalObject::new_empty(()))
    }
}

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
        self.0.items_fmt('{', '}', f)
    }
}

impl<A: IInternalAny> ToString16<A> for Object<A> {
    fn to_string16(&self) -> String16<A> {
        "[object Object]".into()
    }
}
