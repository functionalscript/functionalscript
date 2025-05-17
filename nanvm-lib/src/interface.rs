use core::fmt;
use std::{
    char::decode_utf16,
    ops::{Add, Div, Mul, Shl, Shr, Sub},
};

use crate::{big_int::BigInt, nullish::Nullish, sign::Sign, simple::Simple};

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
    fn concat(self, other: Self) -> Self;
}

pub trait Array<U: Any<Array = Self>>: Complex<U> + Container<Header = (), Item = U> {}

pub trait Object<U: Any<Object = Self>>:
    Complex<U> + Container<Header = (), Item = (U::String16, U)>
{
}

pub trait Function<U: Any<Function = Self>>:
    Complex<U> + Container<Header = u32, Item = u8>
{
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

    fn is_string16(&self) -> bool;
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

    fn to_numeric(v: Self) -> Numeric<Self> {
        // Here we effectively implement ECMAScript logic for an abstract operation ToNumber, see
        // https://tc39.es/ecma262/#sec-tonumber - with the difference that TypeError exception
        // is replaced with Numeric::BigInt variant of the result type.
        match v.unpack() {
            Unpacked::Nullish(n) => match n {
                Nullish::Null => Numeric::Number(0.0),
                Nullish::Undefined => Numeric::Number(f64::NAN),
            },
            Unpacked::Bool(b) => Numeric::Number(if b { 1.0 } else { 0.0 }),
            Unpacked::Number(n) => Numeric::Number(n),
            Unpacked::String16(s) => {
                let items = s.items();
                if items.is_empty() {
                    return Numeric::Number(0.0);
                }
                let string: String = decode_utf16(items.iter().cloned())
                    .map(|r| r.unwrap_or('\u{FFFD}'))
                    .collect();
                if let Ok(n) = string.parse::<f64>() {
                    Numeric::Number(n)
                } else {
                    Numeric::Number(f64::NAN)
                }
            }
            Unpacked::BigInt(i) => Numeric::BigInt(i),
            Unpacked::Array(a) => {
                let items = a.items();
                if items.is_empty() {
                    return Numeric::Number(0.0);
                }
                if items.len() > 1 {
                    return Numeric::Number(f64::NAN);
                }
                Self::to_numeric(items[0].clone())
            }
            // TODO: use valueOf, toString functions for Object when present.
            Unpacked::Object(_) => Numeric::Number(f64::NAN),
            Unpacked::Function(_) => Numeric::Number(f64::NAN),
        }
    }

    // For now for internal exception-throwing operations (e.g. unary_plus applied to BigInt) we use
    // an Any-wrapped string value (a message). Later on we might want to have a schematized
    // exception Any that would carry file, line, etc. along with the message string.
    fn exception(c: &str) -> Result<Self, Self> {
        Err(Self::pack(Unpacked::String16(c.to_string16::<Self>())))
    }

    fn unary_plus(v: Self) -> Result<Self, Self> {
        match Self::to_numeric(v) {
            Numeric::Number(f) => Ok(Self::new_simple(Simple::Number(f))),
            Numeric::BigInt(_) => {
                Self::exception("TypeError: Cannot convert a BigInt value to a number")
            }
        }
    }

    fn unary_minus(v: Self) -> Self {
        // https://tc39.es/ecma262/#sec-unary-minus-operator
        // ECMAScript requires throwing TypeError for Symbol arguments; as of now we don't support
        // Symbol, so we don't return error results. We use unary_plus as a helper function here,
        // handling BigInt case when the error result of unary_plus indicates that case.
        match Self::to_numeric(v) {
            Numeric::Number(f) => Self::new_simple(Simple::Number(-f)),
            Numeric::BigInt(i) => Self::pack(Unpacked::BigInt(i.negate())),
        }
    }

    fn add(v1: Self, v2: Self) -> Result<Self, Self> {
        if v1.is_string16() || v2.is_string16() {
            return Ok(v1.to_string().concat(v2.to_string()).to_unknown());
        }
        match Self::to_numeric(v1) {
            Numeric::BigInt(i1) => match Self::to_numeric(v2) {
                Numeric::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::BigInt(i2) => Ok(Self::pack(Unpacked::BigInt(i1.add(i2)))),
            },
            Numeric::Number(f1) => match Self::to_numeric(v2) {
                Numeric::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::Number(f2) => Ok(Self::new_simple(Simple::Number(f1 + f2))),
            },
        }
    }

    fn sub(v1: Self, v2: Self) -> Result<Self, Self> {
        match Self::to_numeric(v1) {
            Numeric::BigInt(i1) => match Self::to_numeric(v2) {
                Numeric::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::BigInt(i2) => Ok(Self::pack(Unpacked::BigInt(i1.sub(i2)))),
            },
            Numeric::Number(f1) => match Self::to_numeric(v2) {
                Numeric::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::Number(f2) => Ok(Self::new_simple(Simple::Number(f1 - f2))),
            },
        }
    }

    fn mul(v1: Self, v2: Self) -> Result<Self, Self> {
        match Self::to_numeric(v1) {
            Numeric::BigInt(i1) => match Self::to_numeric(v2) {
                Numeric::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::BigInt(i2) => Ok(Self::pack(Unpacked::BigInt(i1.mul(i2)))),
            },
            Numeric::Number(f1) => match Self::to_numeric(v2) {
                Numeric::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::Number(f2) => Ok(Self::new_simple(Simple::Number(f1 * f2))),
            },
        }
    }

    fn div(num: Self, denom: Self) -> Result<Self, Self> {
        match Self::to_numeric(num) {
            Numeric::BigInt(inum) => match Self::to_numeric(denom) {
                Numeric::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::BigInt(idenom) => {
                    if idenom.is_zero() {
                        Self::exception("RangeError: Division by zero")
                    } else {
                        Ok(Self::pack(Unpacked::BigInt(inum.div(idenom))))
                    }
                }
            },
            Numeric::Number(fnum) => match Self::to_numeric(denom) {
                Numeric::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::Number(fdenom) => Ok(Self::new_simple(Simple::Number(fnum / fdenom))),
            },
        }
    }

    fn shl(v1: Self, v2: Self) -> Result<Self, Self> {
        match Self::to_numeric(v1) {
            Numeric::BigInt(i1) => match Self::to_numeric(v2) {
                Numeric::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::BigInt(i2) => Ok(Self::pack(Unpacked::BigInt(i1.shl(i2)))),
            },
            Numeric::Number(f1) => match Self::to_numeric(v2) {
                Numeric::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::Number(f2) => Ok(Self::new_simple(Simple::Number(
                    ((f1 as i128) << ((f2 as i128) & 0x1F)) as f64,
                ))),
            },
        }
    }

    fn shr(v1: Self, v2: Self) -> Result<Self, Self> {
        match Self::to_numeric(v1) {
            Numeric::BigInt(i1) => match Self::to_numeric(v2) {
                Numeric::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::BigInt(i2) => Ok(Self::pack(Unpacked::BigInt(i1.shr(i2)))),
            },
            Numeric::Number(f1) => match Self::to_numeric(v2) {
                Numeric::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Numeric::Number(f2) => Ok(Self::new_simple(Simple::Number(
                    ((f1 as i128) >> ((f2 as i128) & 0x1F)) as f64,
                ))),
            },
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

pub enum Numeric<U: Any> {
    Number(f64),
    BigInt(U::BigInt),
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

    fn to_array_unknown<U: Any>(self) -> U
    where
        Self: IntoIterator<Item = U>,
    {
        self.into_iter().to_complex::<U::Array>().to_unknown()
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

/**
 *  WAny allows to implement operations on Any types.
 * */
#[repr(transparent)]
#[derive(Clone, Debug, PartialEq)]
pub struct WAny<T: Any>(T);

impl<T: Any> WAny<T> {
    pub fn big_int(header: Sign, items: impl IntoIterator<Item = u64>) -> Self {
        Self(T::BigInt::new(header, items).to_unknown())
    }
}

impl<T: Any> Add for WAny<T> {
    type Output = Result<Self, Self>;

    fn add(self, other: Self) -> Self::Output {
        T::add(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Div for WAny<T> {
    type Output = Result<Self, Self>;

    fn div(self, other: Self) -> Self::Output {
        T::div(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Mul for WAny<T> {
    type Output = Result<Self, Self>;

    fn mul(self, other: Self) -> Self::Output {
        T::mul(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Shl for WAny<T> {
    type Output = Result<Self, Self>;

    fn shl(self, other: Self) -> Self::Output {
        T::shl(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Shr for WAny<T> {
    type Output = Result<Self, Self>;

    fn shr(self, other: Self) -> Self::Output {
        T::shr(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Sub for WAny<T> {
    type Output = Result<Self, Self>;

    fn sub(self, other: Self) -> Self::Output {
        T::sub(self.0, other.0).map(Self).map_err(Self)
    }
}
