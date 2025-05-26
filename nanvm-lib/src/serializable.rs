use std::io::{self, Read, Write};

use crate::common::le::Le;

pub trait Serializable: Sized {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()>;
    fn deserialize(read: &mut impl Read) -> io::Result<Self>;
}

impl Serializable for u8 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

impl Serializable for u16 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

impl Serializable for u32 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

impl Serializable for u64 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

impl Serializable for f64 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

#[repr(u8)]
pub enum Tag {
    // Value Types 0b000X_XXXX:
    Undefined = 0b0000_0000,
    Null = 0b0000_0001,
    False = 0b0000_0010,
    True = 0b0000_0011,
    Number = 0b0000_0100,
    // Immutable References 0b0010_XXXX:
    String = 0b0010_0000,
    BigInt = 0b0010_0001,
    // Mutable References 0b0011_XXXX:
    Object = 0b0011_0000,
    Array = 0b0011_0001,
    // Function  = 0b0011_0010,
    // Operations 0b01XX_XXXX:
    // Reserved 0b1XXX_XXXX.
}
