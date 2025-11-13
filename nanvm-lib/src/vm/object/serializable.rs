use std::io::{Read, Result, Write};

use crate::{
    common::serializable::Serializable,
    vm::{IContainer, IVm, Object},
};

impl<A: IVm> Serializable for Object<A> {
    fn serialize(self, writer: &mut impl Write) -> Result<()> {
        self.0.serialize(writer)
    }
    fn deserialize(reader: &mut impl Read) -> Result<Self> {
        A::InternalObject::deserialize(reader).map(Self)
    }
}
