use std::io;

use crate::{
    common::serializable::Serializable,
    vm::{string_coercion::StringCoercion, Any, IContainer, IVm, String16, Unpacked},
};

#[derive(Clone)]
pub struct Array<A: IVm>(pub A::InternalArray);

impl<A: IVm> Default for Array<A> {
    fn default() -> Self {
        Array(A::InternalArray::new_empty(()))
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
        if let Unpacked::Array(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> std::fmt::Debug for Array<A> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.items_fmt('[', ']', f)
    }
}

impl<A: IVm> Serializable for Array<A> {
    fn serialize(&self, writer: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(writer)
    }
    fn deserialize(reader: &mut impl io::Read) -> io::Result<Self> {
        A::InternalArray::deserialize(reader).map(Self)
    }
}

impl<A: IVm, T: IntoIterator<Item = Any<A>>> From<T> for Array<A> {
    fn from(iter: T) -> Self {
        Self(A::InternalArray::new_ok((), iter))
    }
}
impl<A: IVm> StringCoercion<A> for Array<A> {
    fn coerce_to_string(&self) -> Result<String16<A>, Any<A>> {
        // TODO: invoke user-defined methods Symbol.toPrimitive, toString, valueOf.
        //        (0..self.len()).map(|i| self.at(i)).collect()
        let len = self.0.len();
        let mut res = String16::default();
        for i in 0..len {
            if i != 0 {
                res = res + String16::from(",");
            }
            res = res + self.0.at(i).coerce_to_string()?;
        }
        Ok(res)
    }
}
