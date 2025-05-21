use std::io::{self, Read, Write};

use crate::{common::le::Le, interface::Container};

pub trait Serializable: Sized {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()>;
    fn deserialize(read: &mut impl Read) -> io::Result<Self>;
}

impl<T: Container<Header: Serializable, Item: Serializable>> Serializable for T {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.header().serialize(write)?;
        let items = self.items();
        (items.len() as u32).serialize(write)?;
        for item in items {
            item.serialize(write)?;
        }
        Ok(())
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        let header = T::Header::deserialize(read)?;
        let len = u32::deserialize(read)?;
        // TODO: build an iterator for the items and pass it to the T::new(),
        // we don't need another allocation and copy.
        let mut items = Vec::with_capacity(len as usize);
        for _ in 0..len {
            items.push(T::Item::deserialize(read)?);
        }
        Ok(T::new(header, items))
    }
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
