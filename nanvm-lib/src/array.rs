use std::io;

use crate::bast::{Collect, Serailizable};

pub trait Array {
    const SIZE: usize;
    type Item;
    fn as_slice(&self) -> &[Self::Item];
    fn as_mut_slice(&mut self) -> &mut [Self::Item];
    // We can't use `Default` here because it would require the array to be of
    // a type that implements `Default`.
    fn new() -> Self;
}

impl<T: Default + Copy, const SIZE: usize> Array for [T; SIZE] {
    const SIZE: usize = SIZE;
    type Item = T;
    fn as_slice(&self) -> &[T] {
        self
    }
    fn as_mut_slice(&mut self) -> &mut [T] {
        self
    }
    fn new() -> Self {
        [Default::default(); SIZE]
    }
}

pub trait LeBytes: Sized {
    type ByteArray: Array<Item = u8>;
    fn to_le(self) -> Self::ByteArray;
    fn from_le(bytes: Self::ByteArray) -> Self;
    //
    fn le_bytes_serialize(self, c: &mut impl Collect) {
        c.push(self.to_le().as_slice());
    }
    fn le_bytes_deserialize(data: &mut impl Iterator<Item = u8>) -> io::Result<Self> {
        let mut bytes = Self::ByteArray::new();
        for i in 0..Self::ByteArray::SIZE {
            bytes.as_mut_slice()[i] = u8::deserialize(data)?;
        }
        Ok(Self::from_le(bytes))
    }
}

impl LeBytes for u16 {
    type ByteArray = [u8; 2];
    fn to_le(self) -> Self::ByteArray {
        self.to_le_bytes()
    }
    fn from_le(bytes: Self::ByteArray) -> Self {
        u16::from_le_bytes(bytes)
    }
}

impl LeBytes for u32 {
    type ByteArray = [u8; 4];
    fn to_le(self) -> Self::ByteArray {
        self.to_le_bytes()
    }
    fn from_le(bytes: Self::ByteArray) -> Self {
        u32::from_le_bytes(bytes)
    }
}

impl LeBytes for u64 {
    type ByteArray = [u8; 8];
    fn to_le(self) -> Self::ByteArray {
        self.to_le_bytes()
    }
    fn from_le(bytes: Self::ByteArray) -> Self {
        u64::from_le_bytes(bytes)
    }
}

impl LeBytes for f64 {
    type ByteArray = [u8; 8];
    fn to_le(self) -> Self::ByteArray {
        self.to_le_bytes()
    }
    fn from_le(bytes: Self::ByteArray) -> Self {
        f64::from_le_bytes(bytes)
    }
}
