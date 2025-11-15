use std::io::{Read, Result, Write};

use crate::{
    common::serializable::Serializable,
    vm::{Any, IVm, Unpacked},
};

impl<A: IVm> Serializable for Any<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        let u: Unpacked<_> = self.into();
        u.serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Ok(Unpacked::deserialize(read)?.into())
    }
}
