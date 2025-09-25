use crate::{
    common::{iter::Iter, serializable::Serializable},
    vm::{string_coercion::StringCoercion, Any, IContainer, IVm, ToAnyEx, Unpacked},
};
use std::{
    fmt::{Debug, Formatter, Write},
    io, iter::{self, once},
    ops::{Add, AddAssign},
};

#[derive(Clone)]
pub struct String16<A: IVm>(pub A::InternalString16);

pub trait ToString16<A: IVm>: Sized + IntoIterator<Item = u16> {
    fn to_string16(self) -> String16<A> {
        String16(A::InternalString16::new_ok((), self))
    }
}

impl<T: Sized + IntoIterator<Item = u16>, A: IVm> ToString16<A> for T {}

impl<A: IVm> Default for String16<A> {
    fn default() -> Self {
        iter::empty().to_string16()
    }
}

impl<A: IVm> From<String16<A>> for String {
    fn from(value: String16<A>) -> Self {
        String::from_utf16_lossy(&value.0.items_iter().collect::<Vec<_>>())
    }
}

impl<A: IVm> From<&str> for String16<A> {
    fn from(value: &str) -> Self {
        value.encode_utf16().to_string16()
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

impl<A: IVm> Serializable for String16<A> {
    fn serialize(&self, write: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        A::InternalString16::deserialize(read).map(Self)
    }
}

impl<A: IVm> StringCoercion<A> for String16<A> {
    fn coerce_to_string(&self) -> Result<String16<A>, Any<A>> {
        Ok(self.clone())
    }
}

impl<A: IVm> Add for String16<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        self.0.items_iter().chain(rhs.0.items_iter()).to_string16()
    }
}

impl<A: IVm> AddAssign for String16<A> {
    fn add_assign(&mut self, other: Self) {
        *self = self.clone() + other;
    }
}

enum Either<L, R> {
    Left(L),
    Right(R),
}

impl<L, R, T> Iterator for Either<L, R>
where
    L: Iterator<Item = T>,
    R: Iterator<Item = T>,
{
    type Item = T;
    fn next(&mut self) -> Option<T> {
        match self {
            Either::Left(l) => l.next(),
            Either::Right(r) => r.next(),
        }
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        match self {
            Either::Left(l) => l.size_hint(),
            Either::Right(r) => r.size_hint(),
        }
    }
}

pub trait Join<A: IVm>: Sized + Iterator<Item = Result<String16<A>, Any<A>>> {
    fn join(self, separator: String16<A>) -> Result<String16<A>, Any<A>> {
        let x = self.intersperse(Ok(separator));
        let y = x.flat_map(|v| {
            match v {
                Err(e) => Either::Left(once(Err(e))),
                Ok(i) => Either::Right(i.0.items_iter().map(|v| Ok(v))),
            }
        });
        //self.reduce_or_default(|a, b| a + separator.clone() + b)
        let m = A::InternalString16::new((), y)?;
        Ok(String16(m))
    }
}

impl<A: IVm, T: Sized + Iterator<Item = Result<String16<A>, Any<A>>>> Join<A> for T {}
