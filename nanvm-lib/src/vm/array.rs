use core::fmt;
use std::io;

use crate::{
    common::serializable::Serializable,
    vm::{
        internal::ContainerIterator, string16::Join, string_coercion::StringCoercion, Any, IContainer, IVm, String16, Unpacked
    },
};

#[derive(Clone)]
pub struct Array<A: IVm>(A::InternalArray);

impl<A: IVm> Default for Array<A> {
    fn default() -> Self {
        Array(A::InternalArray::new_empty(()))
    }
}

impl<A: IVm> IntoIterator for Array<A> {
    type Item = Any<A>;
    type IntoIter = ContainerIterator<A, A::InternalArray>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}

impl<A: IVm> PartialEq for Array<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Array<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Array(result) = value.into() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> fmt::Debug for Array<A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.items_fmt('[', ']', f)
    }
}

impl<A: IVm> Serializable for Array<A> {
    fn serialize(self, writer: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(writer)
    }
    fn deserialize(reader: &mut impl io::Read) -> io::Result<Self> {
        A::InternalArray::deserialize(reader).map(Self)
    }
}

pub trait ToArray<A: IVm>: Sized + IntoIterator<Item = Any<A>> {
    fn to_array(self) -> Array<A> {
        Array(A::InternalArray::new_ok((), self))
    }
}

impl<A: IVm, T: IntoIterator<Item = Any<A>>> ToArray<A> for T {}

impl<A: IVm> StringCoercion<A> for Array<A> {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        self.0
            .items_iter()
            .map(|v| v.coerce_to_string())
            .join(",".into())
    }
}
