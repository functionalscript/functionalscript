use core::fmt;
use std::char::decode_utf16;

use crate::{nullish::Nullish, sign::Sign, simple::Simple};

pub trait Container: Clone {
    type Header;
    type Item;
    fn header(&self) -> &Self::Header;
    /// For now, we use a slice.
    /// We may change it in the future to support more sophisticated containers.
    fn items(&self) -> &[Self::Item];
    fn new(header: Self::Header, items: impl IntoIterator<Item = Self::Item>) -> Self;
}

pub trait Complex<U: Any>: PartialEq + Sized + Container {
    fn to_unknown(self) -> U;
    fn try_from_unknown(u: U) -> Result<Self, U>;
}

pub trait String16<U: Any<String16 = Self>>:
    Complex<U> + Container<Header = (), Item = u16>
{
}

pub trait BigInt<U: Any<BigInt = Self>>: Complex<U> + Container<Header = Sign, Item = u64> {}

pub trait Array<U: Any<Array = Self>>: Complex<U> + Container<Header = (), Item = U> {}

pub trait Object<U: Any<Object = Self>>:
    Complex<U> + Container<Header = (), Item = (U::String16, U)>
{
}

pub trait Function<U: Any<Function = Self>>:
    Complex<U> + Container<Header = u32, Item = u8>
{
}

#[derive(Debug, PartialEq)]
pub enum RuntimeError {
    TypeError,
    // More error variants will be added in the future as needed.
}

pub trait Any: PartialEq + Sized + Clone + fmt::Debug {
    type String16: String16<Self>;
    type BigInt: BigInt<Self>;
    type Array: Array<Self>;
    type Object: Object<Self>;
    type Function: Function<Self>;

    fn pack(u: Unpacked<Self>) -> Self;
    fn unpack(self) -> Unpacked<Self>;

    fn new_simple(value: Simple) -> Self;
    fn try_to_simple(&self) -> Option<Simple>;

    fn try_to<C: Complex<Self>>(self) -> Result<C, Self> {
        C::try_from_unknown(self)
    }

    fn to_string(self) -> Self::String16 {
        if let Some(simple) = self.try_to_simple() {
            return simple.to_string::<Self>();
        }
        if let Ok(v) = self.clone().try_to::<Self::String16>() {
            return v;
        }
        if self.clone().try_to::<Self::Array>().is_ok() {
            return "".to_string16::<Self>();
        }
        if self.clone().try_to::<Self::Object>().is_ok() {
            return "[object Object]".to_string16::<Self>();
        }
        // bigint and function
        todo!()
    }

    fn unary_plus(v: Self) -> Result<Self, RuntimeError> {
        match v.unpack() {
            Unpacked::Nullish(n) => match n {
                Nullish::Null => Result::Ok(Self::new_simple(Simple::Number(0.0))),
                Nullish::Undefined => Result::Ok(Self::new_simple(Simple::Number(f64::NAN))),
            },
            Unpacked::Bool(b) => {
                Result::Ok(Self::new_simple(Simple::Number(if b { 1.0 } else { 0.0 })))
            }
            Unpacked::Number(n) => Result::Ok(Self::new_simple(Simple::Number(n))),
            Unpacked::String16(s) => {
                let items = s.items();
                if items.is_empty() {
                    return Result::Ok(Self::new_simple(Simple::Number(0.0)));
                }
                let string: String = decode_utf16(items.iter().cloned())
                    .map(|r| r.unwrap_or('\u{FFFD}'))
                    .collect();
                if let Ok(n) = string.parse::<f64>() {
                    return Result::Ok(Self::new_simple(Simple::Number(n)));
                }
                Result::Ok(Self::new_simple(Simple::Number(f64::NAN)))
            }
            Unpacked::BigInt(_) => Result::Err(RuntimeError::TypeError),
            Unpacked::Array(a) => {
                let items = a.items();
                if items.is_empty() {
                    return Result::Ok(Self::new_simple(Simple::Number(0.0)));
                }
                if items.len() > 1 {
                    return Result::Ok(Self::new_simple(Simple::Number(f64::NAN)));
                }
                Self::unary_plus(items[0].clone())
            }
            // TODO: use valueOf, toString functions for Object when present.
            Unpacked::Object(_) => Result::Ok(Self::new_simple(Simple::Number(f64::NAN))),
            Unpacked::Function(_) => Result::Ok(Self::new_simple(Simple::Number(f64::NAN))),
        }
    }
}

#[derive(PartialEq, Debug, Clone)]
pub enum Unpacked<U: Any> {
    Nullish(Nullish),
    Bool(bool),
    Number(f64),
    String16(U::String16),
    BigInt(U::BigInt),
    Array(U::Array),
    Object(U::Object),
    Function(U::Function),
}

pub trait Extension: Sized {
    fn to_complex<C: Complex<impl Any> + Container<Header = ()>>(self) -> C
    where
        Self: IntoIterator<Item = C::Item>,
    {
        C::new((), self)
    }

    fn to_string16_unknown<U: Any>(self) -> U
    where
        Self: IntoIterator<Item = u16>,
    {
        self.to_complex::<U::String16>().to_unknown()
    }

    fn to_array_unknown(self) -> Self::Item
    where
        Self: IntoIterator<Item: Any>,
    {
        self.to_complex::<<Self::Item as Any>::Array>().to_unknown()
    }

    fn to_object_unknown<U: Any>(self) -> U
    where
        Self: IntoIterator<Item = (U::String16, U)>,
    {
        self.to_complex::<U::Object>().to_unknown()
    }
}

impl<T> Extension for T {}

// Utf8

pub trait Utf8 {
    fn to_string16<U: Any>(&self) -> U::String16;
    fn to_unknown<U: Any>(&self) -> U;
}

impl Utf8 for str {
    fn to_string16<U: Any>(&self) -> U::String16 {
        self.encode_utf16().to_complex()
    }

    fn to_unknown<U: Any>(&self) -> U {
        self.to_string16::<U>().to_unknown()
    }
}
