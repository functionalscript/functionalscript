use crate::{
    common::serializable::Serializable,
    vm::{Array, IContainer, IVm},
};
use std::io::{Read, Result, Write};

impl<A: IVm> Serializable for Array<A> {
    fn serialize(self, writer: &mut impl Write) -> Result<()> {
        self.0.serialize(writer)
    }
    fn deserialize(reader: &mut impl Read) -> Result<Self> {
        A::InternalArray::deserialize(reader).map(Self)
    }
}
