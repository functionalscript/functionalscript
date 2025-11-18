use std::io::{Error, ErrorKind, Read, Result, Write};

use crate::{
    common::serializable::Serializable,
    nullish::Nullish,
    vm::{Any, Array, BigInt, Function, IVm, Object, String, Unpacked},
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

impl<A: IVm> Serializable for Unpacked<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> {
        fn complex(write: &mut impl Write, tag: u8, value: impl Serializable) -> Result<()> {
            write.write_all(&[tag])?;
            value.serialize(write)
        }
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
            Unpacked::Number(v) => complex(write, NUMBER, v),
            Unpacked::String(v) => complex(write, STRING, v),
            Unpacked::BigInt(v) => complex(write, BIG_INT, v),
            Unpacked::Object(v) => complex(write, OBJECT, v),
            Unpacked::Array(v) => complex(write, ARRAY, v),
            Unpacked::Function(v) => complex(write, FUNCTION, v),
        }
    }

    fn deserialize(read: &mut impl Read) -> Result<Self> {
        fn simple<A: IVm>(v: impl Into<Unpacked<A>>) -> Result<Unpacked<A>> {
            Ok(v.into())
        }
        fn complex<A: IVm, T: Serializable + Into<Unpacked<A>>>(
            read: &mut impl Read,
        ) -> Result<Unpacked<A>> {
            T::deserialize(read).map(Into::into)
        }
        match u8::deserialize(read)? {
            UNDEFINED => simple(Nullish::Undefined),
            NULL => simple(Nullish::Null),
            FALSE => simple(false),
            TRUE => simple(true),
            NUMBER => complex::<_, f64>(read),
            STRING => complex::<_, String<_>>(read),
            BIG_INT => complex::<_, BigInt<_>>(read),
            OBJECT => complex::<_, Object<_>>(read),
            ARRAY => complex::<_, Array<_>>(read),
            FUNCTION => complex::<_, Function<_>>(read),
            _ => Err(Error::new(ErrorKind::InvalidData, "Unknown tag")),
        }
    }
}
