use std::io::{self, Read, Write};

use crate::{
    common::le::Le,
    container_serializable::ContainerSerializable,
    interface::{Any, Complex, Unpacked},
    nullish::Nullish,
    sign::Sign,
    simple::Simple,
};

pub trait Serializable: Sized {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()>;
    fn deserialize(read: &mut impl Read) -> io::Result<Self>;
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

impl Serializable for bool {
    fn serialize(&self, write: &mut impl Write) -> io::Result<()> {
        (*self as u8).serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Ok(u8::deserialize(read)? != 0)
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
        let x = match self {
            Sign::Positive => 0u8,
            Sign::Negative => 1u8,
        };
        x.serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Ok(match u8::deserialize(read)? {
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

impl<T: Any> Serializable for (T::String16, T) {
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

impl<T: Any> Serializable for T {
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
        match u8::deserialize(read)? {
            UNDEFINED => Ok(Simple::Nullish(Nullish::Undefined).to_unknown()),
            NULL => Ok(Simple::Nullish(Nullish::Null).to_unknown()),
            FALSE => Ok(Simple::Boolean(false).to_unknown()),
            TRUE => Ok(Simple::Boolean(true).to_unknown()),
            NUMBER => {
                let n = f64::deserialize(read)?;
                Ok(Simple::Number(n).to_unknown())
            }
            STRING => {
                let s = T::String16::container_deserialize(read)?;
                Ok(s.to_unknown())
            }
            BIG_INT => {
                let bi = T::BigInt::container_deserialize(read)?;
                Ok(bi.to_unknown())
            }
            OBJECT => {
                let obj = T::Object::container_deserialize(read)?;
                Ok(obj.to_unknown())
            }
            ARRAY => {
                let arr = T::Array::container_deserialize(read)?;
                Ok(arr.to_unknown())
            }
            _ => Err(io::Error::new(io::ErrorKind::InvalidData, "Unknown type")),
        }
    }
}
