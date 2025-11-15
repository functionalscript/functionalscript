use crate::{
    common::serializable::Serializable,
    vm::{IContainer, IVm, String16},
};
use std::io::{Read, Result, Write};

impl<A: IVm> Serializable for String16<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl Read) -> Result<Self> {
        A::InternalString16::deserialize(read).map(Self)
    }
}
