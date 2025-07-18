use crate::{
    common::serializable::Serializable,
    vm::{Any, IContainer, IVm, Js, ToAnyEx, Unpacked},
};
use std::{
    fmt::{Debug, Formatter, Write},
    io,
};

#[derive(Clone)]
pub struct String16<A: IVm>(pub A::InternalString16);

impl<A: IVm> Default for String16<A> {
    fn default() -> Self {
        String16(A::InternalString16::new_empty(()))
    }
}

impl<A: IVm> From<&String16<A>> for std::string::String {
    fn from(value: &String16<A>) -> Self {
        String::from_utf16_lossy(&value.0.collect())
    }
}

impl<A: IVm> From<&str> for String16<A> {
    fn from(value: &str) -> Self {
        String16(A::InternalString16::new_ok((), value.encode_utf16()))
    }
}

impl<A: IVm> From<&str> for Any<A> {
    fn from(value: &str) -> Self {
        let s: String16<_> = value.into();
        s.to_any()
    }
}

impl<A: IVm> PartialEq for String16<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.items_eq(&other.0)
    }
}

const DOUBLE_QUOTE: u16 = '"' as u16;
const BACKSLASH: u16 = '\\' as u16;

impl<A: IVm> Debug for String16<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_char('"')?;
        for i in 0..self.0.len() {
            match self.0.at(i) {
                DOUBLE_QUOTE => f.write_str("\\\"")?,
                BACKSLASH => f.write_str("\\\\")?,
                c if (0x20..=0x7F).contains(&c) => {
                    f.write_char(c as u8 as char)?;
                }
                c => {
                    write!(f, "\\u{c:04X}")?;
                }
            }
        }
        f.write_char('"')
    }
}

impl<A: IVm> TryFrom<Any<A>> for String16<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::String(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> Js<A> for String16<A> {
    fn string(&self) -> String16<A> {
        self.clone()
    }
}

impl<A: IVm> Serializable for String16<A> {
    fn serialize(&self, write: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        A::InternalString16::deserialize(read).map(Self)
    }
}
