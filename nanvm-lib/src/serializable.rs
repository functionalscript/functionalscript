use std::io::{self, Read, Write};

use crate::{interface::Container, le::Le};

pub trait Serializable: Sized {
    fn serialize(&self, c: &mut impl Write) -> io::Result<()>;
    fn deserialize(data: &mut impl Read) -> io::Result<Self>;
}

impl<T: Container<Header: Serializable, Item: Serializable>> Serializable for T {
    fn serialize(&self, c: &mut impl Write) -> io::Result<()> {
        self.header().serialize(c)?;
        let items = self.items();
        (items.len() as u32).serialize(c)?;
        for item in items {
            item.serialize(c)?;
        }
        Ok(())
    }
    fn deserialize(data: &mut impl Read) -> io::Result<Self> {
        let header = T::Header::deserialize(data)?;
        let len = u32::deserialize(data)?;
        // TODO: build an iterator for the items and pass it to the T::new(),
        // we don't need another allocation and copy.
        let mut items = Vec::with_capacity(len as usize);
        for _ in 0..len {
            items.push(T::Item::deserialize(data)?);
        }
        Ok(T::new(header, items))
    }
}

impl Serializable for u8 {
    fn serialize(&self, c: &mut impl Write) -> io::Result<()> {
        c.write(&[*self])?;
        Ok(())
    }
    fn deserialize(data: &mut impl Read) -> io::Result<Self> {
        let mut buf = [0];
        data.read(&mut buf)?;
        Ok(buf[0])
    }
}

impl Serializable for u16 {
    fn serialize(&self, c: &mut impl Write) -> io::Result<()> {
        self.le_bytes_serialize(c)
    }
    fn deserialize(data: &mut impl Read) -> io::Result<Self> {
        Self::le_bytes_deserialize(data)
    }
}

impl Serializable for u32 {
    fn serialize(&self, c: &mut impl Write) -> io::Result<()> {
        self.le_bytes_serialize(c)
    }
    fn deserialize(data: &mut impl Read) -> io::Result<Self> {
        Self::le_bytes_deserialize(data)
    }
}

impl Serializable for u64 {
    fn serialize(&self, c: &mut impl Write) -> io::Result<()> {
        self.le_bytes_serialize(c)
    }
    fn deserialize(data: &mut impl Read) -> io::Result<Self> {
        Self::le_bytes_deserialize(data)
    }
}

impl Serializable for f64 {
    fn serialize(&self, c: &mut impl Write) -> io::Result<()> {
        self.le_bytes_serialize(c)
    }
    fn deserialize(data: &mut impl Read) -> io::Result<Self> {
        Self::le_bytes_deserialize(data)
    }
}
