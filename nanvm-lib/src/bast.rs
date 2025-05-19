use std::io;

use crate::{array::{Array, LeBytes}, interface::Container};

pub trait Collect {
    fn push(&mut self, item: &[u8]);
}

pub trait Serailizable: Sized {
    fn serialize(&self, c: &mut impl Collect);
    fn deserialize(data: &mut impl Iterator<Item = u8>) -> io::Result<Self>;
}

impl<T: Container> Serailizable for T
where T::Header: Serailizable, T::Item: Serailizable
{
    fn serialize(&self, c: &mut impl Collect) {
        self.header().serialize(c);
        let items = self.items();
        (items.len() as u32).serialize(c);
        for item in items {
            item.serialize(c);
        }
    }
    fn deserialize(data: &mut impl Iterator<Item = u8>) -> io::Result<Self> {
        let header = T::Header::deserialize(data)?;
        let len = u32::deserialize(data)?;
        // TODO: build an iterator for the items and pass it to the T:: new constructor.
        let mut items = Vec::with_capacity(len as usize);
        for _ in 0..len {
            items.push(T::Item::deserialize(data)?);
        }
        Ok(T::new(header, items))
    }
}

fn unexpected_eof() -> io::Error {
    io::Error::new(
        io::ErrorKind::UnexpectedEof,
        "Unexpected end of data",
    )
}

impl Serailizable for u8 {
    fn serialize(&self, c: &mut impl Collect) {
        c.push(&[*self]);
    }
    fn deserialize(data: &mut impl Iterator<Item = u8>) -> io::Result<Self> {
        data.next().ok_or_else(unexpected_eof)
    }
}

fn le_bytes_serialize<T: LeBytes>(value: T, c: &mut impl Collect) {
    c.push(value.to_le().as_slice());
}

fn le_bytes_deserialize<T: LeBytes>(data: &mut impl Iterator<Item = u8>) -> io::Result<T> {
    let mut bytes = T::ByteArray::new();
    for i in 0..T::ByteArray::SIZE {
        bytes.as_mut_slice()[i] = u8::deserialize(data)?;
    }
    Ok(T::from_le(bytes))
}

impl Serailizable for u16 {
    fn serialize(&self, c: &mut impl Collect) {
        le_bytes_serialize(*self, c);
    }
    fn deserialize(data: &mut impl Iterator<Item = u8>) -> io::Result<Self> {
        le_bytes_deserialize(data)
    }
}

impl Serailizable for u32 {
    fn serialize(&self, c: &mut impl Collect) {
        le_bytes_serialize(*self, c);
    }
    fn deserialize(data: &mut impl Iterator<Item = u8>) -> io::Result<Self> {
        le_bytes_deserialize(data)
    }
}

impl Serailizable for u64 {
    fn serialize(&self, c: &mut impl Collect) {
        le_bytes_serialize(*self, c);
    }
    fn deserialize(data: &mut impl Iterator<Item = u8>) -> io::Result<Self> {
        le_bytes_deserialize(data)
    }
}

impl Serailizable for f64 {
    fn serialize(&self, c: &mut impl Collect) {
        le_bytes_serialize(*self, c);
    }
    fn deserialize(data: &mut impl Iterator<Item = u8>) -> io::Result<Self> {
        le_bytes_deserialize(data)
    }
}
