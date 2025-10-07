use crate::{
    common::serializable::Serializable,
    vm::{
        string_coercion::{StringCoercion, ToString16Result},
        Any, IContainer, IVm, String16, Unpacked,
    },
};
use core::fmt::{self, Debug, Formatter};
use std::io;

pub type Property<A> = (String16<A>, Any<A>);

#[derive(Clone)]
pub struct Object<A: IVm>(pub A::InternalObject);

impl<A: IVm> Default for Object<A> {
    fn default() -> Self {
        Object(A::InternalObject::new_empty(()))
    }
}

impl<A: IVm> PartialEq for Object<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Object<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Object(result) = value.into() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> Debug for Object<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        self.0.items_fmt('{', '}', f)
    }
}

impl<A: IVm> Serializable for Object<A> {
    fn serialize(self, writer: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(writer)
    }
    fn deserialize(reader: &mut impl io::Read) -> io::Result<Self> {
        A::InternalObject::deserialize(reader).map(Self)
    }
}

impl<A: IVm, T: IntoIterator<Item = Property<A>>> From<T> for Object<A> {
    fn from(iter: T) -> Self {
        Self(A::InternalObject::new_ok((), iter))
    }
}

impl<A: IVm> StringCoercion<A> for Object<A> {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        // TODO: invoke user-defined methods Symbol.toPrimitive, toString, valueOf.
        "[object Object]".to_string16_result()
    }
}
