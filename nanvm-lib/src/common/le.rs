use std::io::{self, Read, Write};

use super::array::Array;

pub trait Le: Sized {
    type ByteArray: Array<Item = u8>;
    fn to_le(self) -> Self::ByteArray;
    fn from_le(bytes: Self::ByteArray) -> Self;
    //
    fn le_serialize(self, write: &mut impl Write) -> io::Result<()> {
        write.write_all(self.to_le().as_slice())
    }
    fn le_deserialize(read: &mut impl Read) -> io::Result<Self> {
        let mut bytes = Self::ByteArray::new();
        read.read_exact(bytes.as_mut_slice())?;
        Ok(Self::from_le(bytes))
    }
}

impl Le for u8 {
    type ByteArray = [u8; 1];
    fn to_le(self) -> Self::ByteArray {
        [self]
    }
    fn from_le(bytes: Self::ByteArray) -> Self {
        bytes[0]
    }
}

impl Le for u16 {
    type ByteArray = [u8; 2];
    fn to_le(self) -> Self::ByteArray {
        self.to_le_bytes()
    }
    fn from_le(bytes: Self::ByteArray) -> Self {
        u16::from_le_bytes(bytes)
    }
}

impl Le for u32 {
    type ByteArray = [u8; 4];
    fn to_le(self) -> Self::ByteArray {
        self.to_le_bytes()
    }
    fn from_le(bytes: Self::ByteArray) -> Self {
        u32::from_le_bytes(bytes)
    }
}

impl Le for u64 {
    type ByteArray = [u8; 8];
    fn to_le(self) -> Self::ByteArray {
        self.to_le_bytes()
    }
    fn from_le(bytes: Self::ByteArray) -> Self {
        u64::from_le_bytes(bytes)
    }
}

impl Le for f64 {
    type ByteArray = [u8; 8];
    fn to_le(self) -> Self::ByteArray {
        self.to_le_bytes()
    }
    fn from_le(bytes: Self::ByteArray) -> Self {
        f64::from_le_bytes(bytes)
    }
}
