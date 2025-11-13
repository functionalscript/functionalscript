use crate::{
    common::{
        array::{RandomAccess, SizedIndex},
        iter::Iter,
        serializable::Serializable,
    },
    vm::{
        any::ToAny, internal::ContainerIterator, number_coercion::NumberCoercion,
        string_coercion::StringCoercion, Any, IContainer, IVm, Unpacked,
    },
};
use core::{
    fmt::{Debug, Formatter, Write},
    iter,
    ops::{Add, AddAssign},
};
use std::{io, ops::Index};

/// ```
/// use nanvm_lib::{
///     vm::{String16, IVm, Any, ToString16, naive::Naive, ToAny},
///     common::array::SizedIndex,
/// };
/// fn string_test<A: IVm>() {
///     let a: String16<A> = "Hello, world!".into();
///     assert_eq!(a.length(), 13);
///     assert_eq!(a[12], '!' as u16);
///     let b: String16<A> = ['H' as u16, 'i' as u16, '!' as u16].to_string16();
///     let c = a.clone() + b;
///     let ac: Any<A> = c.to_any();
///     let d: String16<A> = ac.try_into().unwrap();
///     assert_eq!(d.length(), 16);
///     assert_eq!(format!("{d:?}"), r#""Hello, world!Hi!""#);
///     assert_eq!(char::decode_utf16(d.clone()).map(Result::unwrap).collect::<String>(), "Hello, world!Hi!");
///     let n = "Hello, world!Hi!".into();
///     assert_eq!(d, n);
///     assert_eq!(d, d);
///     assert_ne!(d, a);
/// }
///
/// string_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct String16<A: IVm>(A::InternalString16);

pub trait ToString16 {
    fn to_string16<A: IVm>(self) -> String16<A>
    where
        Self: Sized + IntoIterator<Item = u16>,
    {
        String16(A::InternalString16::new_ok((), self))
    }
}

impl<T> ToString16 for T {}

impl<A: IVm> Default for String16<A> {
    fn default() -> Self {
        iter::empty().to_string16()
    }
}

impl<A: IVm> From<String16<A>> for String {
    fn from(value: String16<A>) -> Self {
        char::decode_utf16(value)
            .map(|r| r.unwrap_or(char::REPLACEMENT_CHARACTER))
            .collect()
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
        for &i in self.0.items().to_iter() {
            match i {
                DOUBLE_QUOTE => f.write_str("\\\"")?,
                BACKSLASH => f.write_str("\\\\")?,
                c => {
                    if (0x20..=0x7F).contains(&c) {
                        f.write_char(c as u8 as char)?;
                    } else {
                        write!(f, "\\u{c:04X}")?;
                    }
                }
            }
        }
        f.write_char('"')
    }
}

impl<A: IVm> TryFrom<Any<A>> for String16<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::String(result) = value.into() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> IntoIterator for String16<A> {
    type Item = u16;
    type IntoIter = ContainerIterator<A, A::InternalString16>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}

impl<A: IVm> Index<u32> for String16<A> {
    type Output = u16;
    /// Currently panics if out of bounds.
    /// TODO: Future versions may change to return `Option<u16>`.
    /// Also we can implement `Index<Any<A>>`, `Index<f64>` and `Index<String16>`.
    fn index(&self, index: u32) -> &Self::Output {
        self.0.items().index(index as usize)
    }
}

impl<A: IVm> SizedIndex<u32> for String16<A> {
    fn length(&self) -> u32 {
        self.0.items().length() as u32
    }
}

impl<A: IVm> Serializable for String16<A> {
    fn serialize(self, write: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        A::InternalString16::deserialize(read).map(Self)
    }
}

impl<A: IVm> StringCoercion<A> for String16<A> {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        Ok(self)
    }
}

impl<A: IVm> Add for String16<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        self.into_iter().chain(rhs).to_string16()
    }
}

impl<A: IVm> AddAssign for String16<A> {
    fn add_assign(&mut self, other: Self) {
        *self = self.clone() + other;
    }
}

pub trait Join<A: IVm>: Sized + Iterator<Item = Result<String16<A>, Any<A>>> {
    fn join(self, separator: String16<A>) -> Result<String16<A>, Any<A>> {
        let i = self.intersperse_(Ok(separator)).try_flatten();
        Ok(String16(A::InternalString16::new((), i)?))
    }
}

impl<A: IVm, T: Sized + Iterator<Item = Result<String16<A>, Any<A>>>> Join<A> for T {}

impl<A: IVm> NumberCoercion<A> for String16<A> {
    fn coerce_to_number(self) -> Result<f64, Any<A>> {
        todo!()
        // let s: String = self.into();
        // let trimmed = s.trim();
        // if trimmed.is_empty() {
        //     return Ok(0.0);
        // }
        // match trimmed.parse::<f64>() {
        //     Ok(v) => Ok(v),
        //     Err(_) => Err(Any(A::from(Unpacked::NaN))),
        // }
    }
}
