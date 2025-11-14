use std::io::{Read, Result, Write};

use crate::{
    common::serializable::Serializable,
    vm::{IContainer, IVm, Object},
};

impl<A: IVm> Serializable for Object<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.0.serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        A::InternalObject::deserialize(read).map(Self)
    }
}
