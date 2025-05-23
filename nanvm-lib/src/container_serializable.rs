use std::io::{self, Read, Write};

use crate::{interface::Container, serializable::Serializable};

pub trait ContainerSerializable: Container<Header: Serializable, Item: Serializable> {
    fn container_serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.header().serialize(write)?;
        let items = self.items();
        (items.len() as u32).serialize(write)?;
        for item in items {
            item.serialize(write)?;
        }
        Ok(())
    }
    fn container_deserialize(read: &mut impl Read) -> io::Result<Self> {
        let header = Self::Header::deserialize(read)?;
        let len = u32::deserialize(read)?;
        // TODO: build an iterator for the items and pass it to the T::new(),
        // we don't need another allocation and copy.
        let mut items = Vec::with_capacity(len as usize);
        for _ in 0..len {
            items.push(Self::Item::deserialize(read)?);
        }
        Ok(Self::new(header, items))
    }
}

impl<T> ContainerSerializable for T where T: Container<Header: Serializable, Item: Serializable> {}
