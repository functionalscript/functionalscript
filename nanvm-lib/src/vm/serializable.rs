use std::io::{Error, ErrorKind, Read, Result, Write};

use crate::{
    common::serializable::Serializable,
    nullish::Nullish,
    vm::{Any, Array, BigInt, Function, IVm, Object, String16, Unpacked},
};

impl<A: IVm> Serializable for Any<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        let u: Unpacked<_> = self.into();
        u.serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Ok(Unpacked::deserialize(read)?.into())
    }
}

// Value Types 0b000X_XXXX:
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
const FUNCTION: u8 = 0b0011_0010;

// Operations 0b01XX_XXXX:
const _CONST_REF: u8 = 0b0100_0000;

fn serialize(write: &mut impl Write, tag: u8, value: impl Serializable) -> Result<()> {
    write.write_all(&[tag])?;
    value.serialize(write)
}

impl<A: IVm> Serializable for Unpacked<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        match self {
            Unpacked::Nullish(v) => match v {
                Nullish::Undefined => UNDEFINED,
                Nullish::Null => NULL,
            }
            .serialize(write),
            Unpacked::Boolean(v) => match v {
                true => TRUE,
                false => FALSE,
            }
            .serialize(write),
            Unpacked::Number(v) => serialize(write, NUMBER, v),
            Unpacked::String(v) => serialize(write, STRING, v),
            Unpacked::BigInt(v) => serialize(write, BIG_INT, v),
            Unpacked::Object(v) => serialize(write, OBJECT, v),
            Unpacked::Array(v) => serialize(write, ARRAY, v),
            Unpacked::Function(v) => serialize(write, FUNCTION, v),
        }
    }

    fn deserialize(read: &mut impl Read) -> Result<Self> {
        match u8::deserialize(read)? {
            UNDEFINED => Ok(Nullish::Undefined.into()),
            NULL => Ok(Nullish::Null.into()),
            FALSE => Ok(false.into()),
            TRUE => Ok(true.into()),
            NUMBER => Ok(f64::deserialize(read)?.into()),
            STRING => Ok(String16::deserialize(read)?.into()),
            BIG_INT => Ok(BigInt::deserialize(read)?.into()),
            OBJECT => Ok(Object::deserialize(read)?.into()),
            ARRAY => Ok(Array::deserialize(read)?.into()),
            FUNCTION => Ok(Function::deserialize(read)?.into()),
            _ => Err(Error::new(ErrorKind::InvalidData, "Unknown tag")),
        }
    }
}
