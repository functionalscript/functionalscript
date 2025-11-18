use crate::{
    common::serializable::Serializable,
    vm::{IContainer, IVm, String},
};
use std::io::{Read, Result, Write};

impl<A: IVm> Serializable for String<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl Read) -> Result<Self> {
        A::InternalString::deserialize(read).map(Self)
    }
}
