use std::io::{self, Read, Result, Write};

use crate::{common::le::Le, sign::Sign};

pub trait Serializable: Sized {
    fn serialize(self, write: &mut impl Write) -> Result<()>;
    fn deserialize(read: &mut impl Read) -> Result<Self>;
}

impl Serializable for u8 {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Self::le_deserialize(read)
    }
}

impl Serializable for u16 {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Self::le_deserialize(read)
    }
}

impl Serializable for u32 {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Self::le_deserialize(read)
    }
}

impl Serializable for u64 {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Self::le_deserialize(read)
    }
}

impl Serializable for f64 {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Self::le_deserialize(read)
    }
}

impl Serializable for bool {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        (self as u8).serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Ok(u8::deserialize(read)? != 0)
    }
}

impl Serializable for () {
    fn serialize(self, _write: &mut impl Write) -> Result<()> {
        Ok(())
    }
    fn deserialize(_read: &mut impl Read) -> Result<Self> {
        Ok(())
    }
}

impl Serializable for Sign {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        let x = match self {
            Sign::Positive => 0u8,
            Sign::Negative => 1u8,
        };
        x.serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Ok(match u8::deserialize(read)? {
            0 => Sign::Positive,
            1 => Sign::Negative,
            _ => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "Invalid Sign value",
                ))
            }
        })
    }
}

impl<A: Serializable, B: Serializable> Serializable for (A, B) {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.0.serialize(write)?;
        self.1.serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        let first = A::deserialize(read)?;
        let second = B::deserialize(read)?;
        Ok((first, second))
    }
}
