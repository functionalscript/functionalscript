use std::io::{self, Read, Write};

use crate::{common::le::Le, interface::{Any, Container, Unpacked}, nullish::Nullish};

pub trait Serializable: Sized {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()>;
    fn deserialize(read: &mut impl Read) -> io::Result<Self>;
}

fn serialize_container<C, F, W>(c: &C, write: &mut W, mut serialize_item: F) -> io::Result<()>
where
    C: Container,
    C::Header: Serializable,
    F: FnMut(&C::Item, &mut W) -> io::Result<()>,
    W: Write,
{
    c.header().serialize(write)?;
    let items = c.items();
    (items.len() as u32).serialize(write)?;
    for item in items {
        serialize_item(item, write)?;
    }
    Ok(())
}

fn deserialize_container<C, F, R>(read: &mut R, mut deserialize_item: F) -> io::Result<C>
where
    C: Container,
    C::Header: Serializable,
    F: FnMut(&mut R) -> io::Result<C::Item>,
    R: Read,
{
    let header = C::Header::deserialize(read)?;
    let len = u32::deserialize(read)?;
    let mut items = Vec::with_capacity(len as usize);
    for _ in 0..len {
        items.push(deserialize_item(read)?);
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

impl Serializable for crate::sign::Sign {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        // encode as 0 = Positive, 1 = Negative
        let tag: u8 = match self {
            crate::sign::Sign::Positive => 0,
            crate::sign::Sign::Negative => 1,
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

impl<A: Serializable, B: Serializable> Serializable for (A, B) {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.0.serialize(write)?;
        self.1.serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        let a = A::deserialize(read)?;
        let b = B::deserialize(read)?;
        Ok((a, b))
    }
}


impl<T: Any> Serializable for T {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        use Nullish::*;
        match self.clone().unpack() {
            Unpacked::Nullish(Null) => {
                0u8.serialize(write)
            }
            Unpacked::Nullish(Undefined) => {
                1u8.serialize(write)
            }
            Unpacked::Bool(false) => {
                2u8.serialize(write)
            }
            Unpacked::Bool(true) => {
                3u8.serialize(write)
            }
            Unpacked::Number(n) => {
                4u8.serialize(write)?;
                n.serialize(write)
            }
            Unpacked::String16(s) => {
                5u8.serialize(write)?;
                serialize_container(&s, write, |item, w| item.serialize(w))
            }
            Unpacked::Array(arr) => {
                6u8.serialize(write)?;
                serialize_container(&arr, write, |item, w| item.serialize(w))
            }
            Unpacked::Object(obj) => {
                7u8.serialize(write)?;
                serialize_container(&obj, write, |(key, value), w| {
                    // serialize key String16 container
                    serialize_container(key, w, |code_unit, w2| code_unit.serialize(w2))?;
                    value.serialize(w)
                })
            }
            Unpacked::BigInt(bi) => {
                8u8.serialize(write)?;
                serialize_container(&bi, write, |item, w| item.serialize(w))
            }
            Unpacked::Function(_) => {
                Err(io::Error::new(io::ErrorKind::InvalidData, "function serialization not supported"))
            }
        }
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        let tag = u8::deserialize(read)?;
        match tag {
            0 => Ok(Self::pack(Unpacked::Nullish(Nullish::Null))),
            1 => Ok(Self::pack(Unpacked::Nullish(Nullish::Undefined))),
            2 => Ok(Self::pack(Unpacked::Bool(false))),
            3 => Ok(Self::pack(Unpacked::Bool(true))),
            4 => {
                let n = f64::deserialize(read)?;
                Ok(Self::pack(Unpacked::Number(n)))
            }
            5 => {
                let s = deserialize_container::<<Self as Any>::String16, _, _>(read, |r| u16::deserialize(r))?;
                Ok(Self::pack(Unpacked::String16(s)))
            }
            6 => {
                let arr = deserialize_container::<<Self as Any>::Array, _, _>(read, |r| Self::deserialize(r))?;
                Ok(Self::pack(Unpacked::Array(arr)))
            }
            7 => {
                let obj = deserialize_container::<<Self as Any>::Object, _, _>(read, |r| {
                    let key = deserialize_container::<<Self as Any>::String16, _, _>(r, |rr| u16::deserialize(rr))?;
                    let value = Self::deserialize(r)?;
                    Ok((key, value))
                })?;
                Ok(Self::pack(Unpacked::Object(obj)))
            }
            8 => {
                let bi = deserialize_container::<<Self as Any>::BigInt, _, _>(read, |r| u64::deserialize(r))?;
                Ok(Self::pack(Unpacked::BigInt(bi)))
            }
            _ => Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("invalid Any type tag {}", tag),
            )),
        }
    }
}
