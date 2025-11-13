use std::io::{Error, ErrorKind, Read, Result, Write};

use crate::{
    common::serializable::Serializable,
    nullish::Nullish,
    vm::{internal::IContainer, Any, Array, BigInt, Function, IVm, Object, String16, Unpacked},
};

impl<A: IVm> Serializable for Any<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.0.to_unpacked().serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        Ok(Unpacked::deserialize(read)?.into())
    }
}

impl<A: IVm> Serializable for Array<A> {
    fn serialize(self, writer: &mut impl Write) -> Result<()> {
        self.0.serialize(writer)
    }
    fn deserialize(reader: &mut impl Read) -> Result<Self> {
        A::InternalArray::deserialize(reader).map(Self)
    }
}

impl<A: IVm> Serializable for Object<A> {
    fn serialize(self, writer: &mut impl Write) -> Result<()> {
        self.0.serialize(writer)
    }
    fn deserialize(reader: &mut impl Read) -> Result<Self> {
        A::InternalObject::deserialize(reader).map(Self)
    }
}

impl<A: IVm> Serializable for Function<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.0.serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        A::InternalFunction::deserialize(read).map(Self)
    }
}

impl<A: IVm> Serializable for BigInt<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl Read) -> Result<Self> {
        A::InternalBigInt::deserialize(read).map(Self)
    }
}

impl<A: IVm> Serializable for String16<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl Read) -> Result<Self> {
        A::InternalString16::deserialize(read).map(Self)
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

fn serialize_ref(write: &mut impl Write, tag: u8, value: impl Serializable) -> Result<()> {
    write.write_all(&[tag])?;
    value.serialize(write)
}

impl<A: IVm> Serializable for Unpacked<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        match self {
            Unpacked::Nullish(v) => {
                let tag = match v {
                    Nullish::Undefined => UNDEFINED,
                    Nullish::Null => NULL,
                };
                tag.serialize(write)
            }
            Unpacked::Boolean(v) => {
                let tag = match v {
                    true => TRUE,
                    false => FALSE,
                };
                tag.serialize(write)
            }
            Unpacked::Number(v) => serialize_ref(write, NUMBER, v),
            Unpacked::String(v) => serialize_ref(write, STRING, v),
            Unpacked::BigInt(v) => serialize_ref(write, BIG_INT, v),
            Unpacked::Object(v) => serialize_ref(write, OBJECT, v),
            Unpacked::Array(v) => serialize_ref(write, ARRAY, v),
            Unpacked::Function(v) => serialize_ref(write, FUNCTION, v),
        }
    }

    fn deserialize(read: &mut impl Read) -> Result<Self> {
        match u8::deserialize(read)? {
            UNDEFINED => Ok(Nullish::Undefined.into()),
            NULL => Ok(Nullish::Null.into()),
            FALSE => Ok(false.into()),
            TRUE => Ok(true.into()),
            NUMBER => Ok(f64::deserialize(read)?.into()),
            STRING => Ok(String16::<A>::deserialize(read)?.into()),
            BIG_INT => Ok(BigInt::<A>::deserialize(read)?.into()),
            OBJECT => Ok(Object::<A>::deserialize(read)?.into()),
            ARRAY => Ok(Array::<A>::deserialize(read)?.into()),
            FUNCTION => Ok(Function::<A>::deserialize(read)?.into()),
            _ => Err(Error::new(ErrorKind::InvalidData, "Unknown tag")),
        }
    }
}
