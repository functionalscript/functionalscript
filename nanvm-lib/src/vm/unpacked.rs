use crate::{
    common::serializable::Serializable,
    nullish::Nullish,
    vm::{
        number_coercion::NumberCoercion, string_coercion::StringCoercion, Any, Array, BigInt,
        Function, IVm, Object, String16,
    },
};
use core::fmt::Debug;
use std::io::{self, Read, Write};

#[derive(Clone)]
pub enum Unpacked<A: IVm> {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
    String(String16<A>),
    BigInt(BigInt<A>),
    Object(Object<A>),
    Array(Array<A>),
    Function(Function<A>),
}

impl<A: IVm> Debug for Unpacked<A> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Nullish(x) => x.fmt(f),
            Self::Boolean(x) => x.fmt(f),
            Self::Number(x) => x.fmt(f),
            Self::String(x) => x.fmt(f),
            Self::BigInt(x) => x.fmt(f),
            Self::Object(x) => x.fmt(f),
            Self::Array(x) => x.fmt(f),
            Self::Function(x) => x.fmt(f),
        }
    }
}

impl<A: IVm> PartialEq for Unpacked<A> {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Nullish(a), Self::Nullish(b)) => a == b,
            (Self::Boolean(a), Self::Boolean(b)) => a == b,
            (Self::Number(a), Self::Number(b)) => a == b,
            (Self::String(a), Self::String(b)) => a == b,
            (Self::BigInt(a), Self::BigInt(b)) => a == b,
            (Self::Object(a), Self::Object(b)) => a == b,
            (Self::Array(a), Self::Array(b)) => a == b,
            (Self::Function(a), Self::Function(b)) => a == b,
            _ => false,
        }
    }
}

impl<A: IVm> From<Nullish> for Unpacked<A> {
    fn from(value: Nullish) -> Self {
        Unpacked::Nullish(value)
    }
}

impl<A: IVm> From<bool> for Unpacked<A> {
    fn from(value: bool) -> Self {
        Unpacked::Boolean(value)
    }
}
impl<A: IVm> From<f64> for Unpacked<A> {
    fn from(value: f64) -> Self {
        Unpacked::Number(value)
    }
}

impl<A: IVm> From<String16<A>> for Unpacked<A> {
    fn from(value: String16<A>) -> Self {
        Unpacked::String(value)
    }
}

impl<A: IVm> From<BigInt<A>> for Unpacked<A> {
    fn from(value: BigInt<A>) -> Self {
        Unpacked::BigInt(value)
    }
}

impl<A: IVm> From<Object<A>> for Unpacked<A> {
    fn from(value: Object<A>) -> Self {
        Unpacked::Object(value)
    }
}

impl<A: IVm> From<Array<A>> for Unpacked<A> {
    fn from(value: Array<A>) -> Self {
        Unpacked::Array(value)
    }
}

impl<A: IVm> From<Function<A>> for Unpacked<A> {
    fn from(value: Function<A>) -> Self {
        Unpacked::Function(value)
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

fn serialize(write: &mut impl Write, tag: u8, value: impl Serializable) -> io::Result<()> {
    write.write_all(&[tag])?;
    value.serialize(write)
}

impl<A: IVm> Serializable for Unpacked<A> {
    fn serialize(self, write: &mut impl Write) -> io::Result<()> {
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
            Unpacked::Number(v) => serialize(write, NUMBER, v),
            Unpacked::String(v) => serialize(write, STRING, v),
            Unpacked::BigInt(v) => serialize(write, BIG_INT, v),
            Unpacked::Object(v) => serialize(write, OBJECT, v),
            Unpacked::Array(v) => serialize(write, ARRAY, v),
            Unpacked::Function(v) => serialize(write, FUNCTION, v),
        }
    }

    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
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
            _ => Err(io::Error::new(io::ErrorKind::InvalidData, "Unknown tag")),
        }
    }
}

impl<A: IVm> StringCoercion<A> for Unpacked<A> {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        match self {
            Unpacked::Nullish(n) => n.coerce_to_string(),
            Unpacked::Boolean(b) => b.coerce_to_string(),
            Unpacked::Number(n) => n.coerce_to_string(),
            Unpacked::String(s) => s.coerce_to_string(),
            Unpacked::BigInt(i) => i.coerce_to_string(),
            Unpacked::Object(o) => o.coerce_to_string(),
            Unpacked::Array(a) => a.coerce_to_string(),
            Unpacked::Function(f) => f.coerce_to_string(),
        }
    }
}

impl<A: IVm> NumberCoercion<A> for Unpacked<A> {
    fn coerce_to_number(self) -> Result<f64, Any<A>> {
        match self {
            Unpacked::Nullish(n) => n.coerce_to_number(),
            Unpacked::Boolean(b) => b.coerce_to_number(),
            Unpacked::Number(n) => n.coerce_to_number(),
            Unpacked::String(s) => s.coerce_to_number(),
            Unpacked::BigInt(i) => i.coerce_to_number(),
            Unpacked::Object(o) => o.coerce_to_number(),
            Unpacked::Array(a) => a.coerce_to_number(),
            Unpacked::Function(f) => f.coerce_to_number(),
        }
    }
}
