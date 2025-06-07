use std::io::{self, Read, Write};

use crate::{
    common::le::Le,
    container_serializable::ContainerSerializable,
    interface::{Any, Complex, Unpacked},
    nullish::Nullish,
    sign::Sign,
    simple::Simple,
};

pub trait Serializable<A: Any>: Sized {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()>;
    fn deserialize(read: &mut impl Read) -> io::Result<Self>;
}

impl<A: Any> Serializable<A> for u8 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

impl<A: Any> Serializable<A> for u16 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

impl<A: Any> Serializable<A> for u32 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

impl<A: Any> Serializable<A> for u64 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

impl<A: Any> Serializable<A> for f64 {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Self::le_deserialize(read)
    }
}

impl<A: Any> Serializable<A> for bool {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        (*self as u8).le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Ok(u8::le_deserialize(read)? != 0)
    }
}

impl<A: Any> Serializable<A> for () {
    fn serialize(&self, _write: &mut impl Write) -> io::Result<()> {
        Ok(())
    }
    fn deserialize(_read: &mut impl Read) -> io::Result<Self> {
        Ok(())
    }
}

impl<A: Any> Serializable<A> for Sign {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        match self {
            Sign::Positive => 0u8,
            Sign::Negative => 1u8,
        }
        .le_serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Ok(match u8::le_deserialize(read)? {
            0 => Sign::Positive,
            1 => Sign::Negative,
            _ => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "Invalid Sign value",
                ))
            }
        })
    }
}

impl<T: Any> Serializable<T> for (T::String16, T) {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        self.0.container_serialize(write)?;
        self.1.serialize(write)
    }

    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        let key = T::String16::container_deserialize(read)?;
        let value = T::deserialize(read)?;
        Ok((key, value))
    }
}

// Value Types 0b0000_XXXX:
const UNDEFINED: u8 = 0b0000_0000;
const NULL: u8 = 0b0000_0001;
const FALSE: u8 = 0b0000_0010;
const TRUE: u8 = 0b0000_0011;
const NUMBER: u8 = 0b0000_0100;

// Immutable References 0b0010_XXXX:
const STRING: u8 = 0b0010_0000;
const BIG_INT: u8 = 0b0010_0001;

// Mutable References 0b0011_XXXX:
const OBJECT: u8 = 0b0011_0000;
const ARRAY: u8 = 0b0011_0001;

// Operations 0b01XX_XXXX:
const CONST_REF: u8 = 0b0100_0000;

impl<T: Any> Serializable<T> for T {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        match self.clone().unpack() {
            Unpacked::Nullish(v) => {
                let x = if v == Nullish::Undefined {
                    UNDEFINED
                } else {
                    NULL
                };
                x.serialize(write)
            }
            Unpacked::Bool(v) => (if v { TRUE } else { FALSE }).serialize(write),
            Unpacked::Number(n) => {
                NUMBER.serialize(write)?;
                n.serialize(write)
            }
            Unpacked::String16(s) => {
                STRING.serialize(write)?;
                s.container_serialize(write)
            }
            Unpacked::BigInt(bi) => {
                BIG_INT.serialize(write)?;
                bi.container_serialize(write)
            }
            Unpacked::Object(obj) => {
                OBJECT.serialize(write)?;
                obj.container_serialize(write)
            }
            Unpacked::Array(arr) => {
                ARRAY.serialize(write)?;
                arr.container_serialize(write)
            }
            Unpacked::Function(_) => todo!(),
        }
    }

    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Ok(match u8::deserialize(read)? {
            UNDEFINED => Simple::Nullish(Nullish::Undefined).to_unknown(),
            NULL => Simple::Nullish(Nullish::Null).to_unknown(),
            FALSE => Simple::Boolean(false).to_unknown(),
            TRUE => Simple::Boolean(true).to_unknown(),
            NUMBER => Simple::Number(f64::deserialize(read)?).to_unknown(),
            STRING => T::String16::container_deserialize(read)?.to_unknown(),
            BIG_INT => T::BigInt::container_deserialize(read)?.to_unknown(),
            OBJECT => T::Object::container_deserialize(read)?.to_unknown(),
            ARRAY => T::Array::container_deserialize(read)?.to_unknown(),
            _ => return Err(io::Error::new(io::ErrorKind::InvalidData, "Unknown type")),
        })
    }
}
