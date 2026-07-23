use crate::{
    common::serializable::Serializable,
    vm::{BigInt, IContainer, IVm},
};
use std::io::{Read, Result, Write};

impl<A: IVm> Serializable for BigInt<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl Read) -> Result<Self> {
        A::InternalBigInt::deserialize(read).map(Self)
    }
}
