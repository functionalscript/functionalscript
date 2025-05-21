use std::io::{self, Write};

use crate::{
    array::Array,
    serializable::Serializable,
};

pub trait Le: Sized {
    type ByteArray: Array<Item = u8>;
    fn to_le(self) -> Self::ByteArray;
    fn from_le(bytes: Self::ByteArray) -> Self;
    //
    fn le_bytes_serialize(self, c: &mut impl Write) -> io::Result<()> {
        c.write(self.to_le().as_slice())?;
        Ok(())
    }
    fn le_bytes_deserialize(data: &mut impl Iterator<Item = u8>) -> io::Result<Self> {
        let mut bytes = Self::ByteArray::new();
        for i in 0..Self::ByteArray::SIZE {
            bytes.as_mut_slice()[i] = u8::deserialize(data)?;
        }
        Ok(Self::from_le(bytes))
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
