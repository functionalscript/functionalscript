use std::io::{self, Read, Write};

use crate::{
    common::le::Le,
    interface::{Any, Container, Unpacked},
    nullish::Nullish,
    sign::Sign,
};

pub trait Serializable: Sized {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()>;
    fn deserialize(read: &mut impl Read) -> io::Result<Self>;
}

fn serialize_container<C>(c: &C, write: &mut impl Write) -> io::Result<()>
where
    C: Container<Header: Serializable, Item: Serializable>,
{
    c.header().serialize(write)?;
    let items = c.items();
    (items.len() as u32).serialize(write)?;
    for item in items {
        item.serialize(write)?;
    }
    Ok(())
}

fn deserialize_container<C>(read: &mut impl Read) -> io::Result<C>
where
    C: Container<Header: Serializable, Item: Serializable>,
{
    let header = C::Header::deserialize(read)?;
    let len = u32::deserialize(read)?;
    let mut items = Vec::with_capacity(len as usize);
    for _ in 0..len {
        items.push(C::Item::deserialize(read)?);
    }
    Ok(C::new(header, items))
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

impl Serializable for () {
    fn serialize(&self, _write: &mut impl Write) -> io::Result<()> {
        Ok(())
    }
    fn deserialize(_read: &mut impl Read) -> io::Result<Self> {
        Ok(())
    }
}

impl Serializable for Sign {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        // encode as 0 = Positive, 1 = Negative
        let tag: u8 = match self {
            Sign::Positive => 0,
            Sign::Negative => 1,
        };
        tag.serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        let tag = u8::deserialize(read)?;
        match tag {
            0 => Ok(crate::sign::Sign::Positive),
            1 => Ok(crate::sign::Sign::Negative),
            _ => Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("invalid sign tag {}", tag),
            )),
        }
    }
}

impl<T: Any> Serializable for (T::String16, T) {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        serialize_container(&self.0, write)?;
        self.1.serialize(write)
    }

    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        let a = deserialize_container(read)?;
        let b = T::deserialize(read)?;
        Ok((a, b))
    }
}

const NULL: u8 = 0;
const UNDEFINED: u8 = 1;
const FALSE: u8 = 2;
const TRUE: u8 = 3;
const NUMBER: u8 = 4;
const STRING: u8 = 5;
const ARRAY: u8 = 6;
const OBJECT: u8 = 7;
const BIGINT: u8 = 8;

impl<T: Any> Serializable for T {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        use Nullish::*;
        match self.clone().unpack() {
            Unpacked::Nullish(Null) => NULL.serialize(write),
            Unpacked::Nullish(Undefined) => UNDEFINED.serialize(write),
            Unpacked::Bool(false) => FALSE.serialize(write),
            Unpacked::Bool(true) => TRUE.serialize(write),
            Unpacked::Number(n) => {
                NUMBER.serialize(write)?;
                n.serialize(write)
            }
            Unpacked::String16(s) => {
                STRING.serialize(write)?;
                serialize_container(&s, write)
            }
            Unpacked::Array(arr) => {
                ARRAY.serialize(write)?;
                serialize_container(&arr, write)
            }
            Unpacked::Object(obj) => {
                OBJECT.serialize(write)?;
                serialize_container(&obj, write)
            }
            Unpacked::BigInt(bi) => {
                BIGINT.serialize(write)?;
                serialize_container(&bi, write)
            }
            Unpacked::Function(_) => Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "function serialization not supported",
            )),
        }
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        let tag = u8::deserialize(read)?;
        match tag {
            NULL => Ok(Self::pack(Unpacked::Nullish(Nullish::Null))),
            UNDEFINED => Ok(Self::pack(Unpacked::Nullish(Nullish::Undefined))),
            FALSE => Ok(Self::pack(Unpacked::Bool(false))),
            TRUE => Ok(Self::pack(Unpacked::Bool(true))),
            NUMBER => {
                let n = f64::deserialize(read)?;
                Ok(Self::pack(Unpacked::Number(n)))
            }
            STRING => {
                let s: T::String16 = deserialize_container(read)?;
                Ok(Self::pack(Unpacked::String16(s)))
            }
            ARRAY => {
                let arr: T::Array = deserialize_container(read)?;
                Ok(Self::pack(Unpacked::Array(arr)))
            }
            OBJECT => {
                let obj: T::Object = deserialize_container(read)?;
                Ok(Self::pack(Unpacked::Object(obj)))
            }
            BIGINT => {
                let bi: T::BigInt = deserialize_container(read)?;
                Ok(Self::pack(Unpacked::BigInt(bi)))
            }
            _ => Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("invalid Any type tag {}", tag),
            )),
        }
    }
}
