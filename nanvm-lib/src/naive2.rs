use core::{fmt, marker::PhantomData};
use std::rc;

use crate::{interface2, nullish::Nullish, sign::Sign, simple::Simple};

pub trait Policy {
    type Header: PartialEq + fmt::Debug + Clone;
    type Item: fmt::Debug;
    fn items_eq(a: &[Self::Item], b: &[Self::Item]) -> bool;
}

#[derive(Clone)]
pub struct ValuePolicy<H, T>(PhantomData<(H, T)>);

impl<H: PartialEq + fmt::Debug + Clone, T: PartialEq + fmt::Debug> Policy for ValuePolicy<H, T> {
    type Header = H;
    type Item = T;
    fn items_eq(a: &[Self::Item], b: &[Self::Item]) -> bool {
        a == b
    }
}

#[derive(Clone)]
pub struct RefPolicy<H, T>(PhantomData<(H, T)>);

impl<H: PartialEq + fmt::Debug + Clone, T: fmt::Debug> Policy for RefPolicy<H, T> {
    type Header = H;
    type Item = T;
    fn items_eq(a: &[Self::Item], b: &[Self::Item]) -> bool {
        a.as_ptr() == b.as_ptr()
    }
}

pub struct Complex<P: Policy> {
    header: P::Header,
    items: rc::Rc<[P::Item]>,
}

impl<P: Policy> Clone for Complex<P> {
    fn clone(&self) -> Self {
        Self { header: self.header.clone(), items: self.items.clone() }
    }
}

impl<P: Policy> fmt::Debug for Complex<P> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Complex")
            .field("header", &self.header)
            .field("items", &self.items)
            .finish()
    }
}

impl<P: Policy> PartialEq for Complex<P> {
    fn eq(&self, other: &Self) -> bool {
        self.header == other.header && P::items_eq(&self.items, &other.items)
    }
}

impl<P: Policy> interface2::Container for Complex<P> {
    type Header = P::Header;
    type Item = P::Item;
    fn items(&self) -> &[Self::Item] {
        &*self.items
    }
    fn header(&self) -> &Self::Header {
        &self.header
    }
    fn new(header: Self::Header, items: impl IntoIterator<Item = Self::Item>) -> Self {
        Self {
            header,
            items: rc::Rc::from_iter(items),
        }
    }
}

// String

pub type String16 = Complex<ValuePolicy<(), u16>>;

impl interface2::Complex<Any> for String16 {
    fn to_unknown(self) -> Any {
        Any::String16(self)
    }
    fn try_from_unknown(u: Any) -> Result<Self, Any> {
        if let Any::String16(v) = u {
            Ok(v)
        } else {
            Err(u)
        }
    }
}

impl interface2::String16<Any> for String16 {}

// BigInt

pub type BigInt = Complex<ValuePolicy<Sign, u64>>;

impl interface2::Complex<Any> for BigInt {
    fn to_unknown(self) -> Any {
        Any::BigInt(self)
    }
    fn try_from_unknown(u: Any) -> Result<Self, Any> {
        if let Any::BigInt(v) = u {
            Ok(v)
        } else {
            Err(u)
        }
    }
}

impl interface2::BigInt<Any> for BigInt {}

// Array

pub type Array = Complex<RefPolicy<(), Any>>;

impl interface2::Complex<Any> for Array {
    fn to_unknown(self) -> Any {
        Any::Array(self)
    }
    fn try_from_unknown(u: Any) -> Result<Self, Any> {
        if let Any::Array(v) = u {
            Ok(v)
        } else {
            Err(u)
        }
    }
}

impl interface2::Array<Any> for Array {}

// Object

pub type Object = Complex<RefPolicy<(), (String16, Any)>>;

impl interface2::Complex<Any> for Object {
    fn to_unknown(self) -> Any {
        Any::Object(self)
    }
    fn try_from_unknown(u: Any) -> Result<Self, Any> {
        if let Any::Object(v) = u {
            Ok(v)
        } else {
            Err(u)
        }
    }
}

impl interface2::Object<Any> for Object {}

// Function

pub type Function = Complex<RefPolicy<u32, u8>>;

impl interface2::Complex<Any> for Function {
    fn to_unknown(self) -> Any {
        Any::Function(self)
    }

    fn try_from_unknown(u: Any) -> Result<Self, Any> {
        if let Any::Function(v) = u {
            Ok(v)
        } else {
            Err(u)
        }
    }
}

impl interface2::Function<Any> for Function {}

// Unknown

#[derive(PartialEq, Debug, Clone)]
pub enum Any {
    Simple(Simple),
    String16(String16),
    BigInt(BigInt),
    Array(Array),
    Object(Object),
    Function(Function),
}

impl interface2::Any for Any {
    type String16 = String16;
    type BigInt = BigInt;
    type Array = Array;
    type Object = Object;
    type Function = Function;

    fn new_simple(value: Simple) -> Self {
        Self::Simple(value)
    }

    fn try_to_simple(&self) -> Option<Simple> {
        if let Self::Simple(v) = self {
            Some(v.clone())
        } else {
            None
        }
    }

    fn pack(u: interface2::Unpacked<Self>) -> Self {
        match u {
            interface2::Unpacked::Nullish(n) => Self::Simple(Simple::Nullish(n)),
            interface2::Unpacked::Bool(n) => Self::Simple(Simple::Boolean(n)),
            interface2::Unpacked::Number(n) => Self::Simple(Simple::Number(n)),
            interface2::Unpacked::String16(n) => Self::String16(n),
            interface2::Unpacked::BigInt(n) => Self::BigInt(n),
            interface2::Unpacked::Array(n) => Self::Array(n),
            interface2::Unpacked::Object(n) => Self::Object(n),
            interface2::Unpacked::Function(n) => Self::Function(n),
        }
    }

    fn unpack(self) -> interface2::Unpacked<Self> {
        match self {
            Any::Simple(Simple::Nullish(n)) => interface2::Unpacked::Nullish(n),
            Any::Simple(Simple::Boolean(n)) => interface2::Unpacked::Bool(n),
            Any::Simple(Simple::Number(n)) => interface2::Unpacked::Number(n),
            Any::String16(complex) => interface2::Unpacked::String16(complex),
            Any::BigInt(complex) => interface2::Unpacked::BigInt(complex),
            Any::Array(complex) => interface2::Unpacked::Array(complex),
            Any::Object(complex) => interface2::Unpacked::Object(complex),
            Any::Function(complex) => interface2::Unpacked::Function(complex),
        }
    }
}
