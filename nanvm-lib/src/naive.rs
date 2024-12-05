/// Naive implementation of VM.
use core::{fmt, marker::PhantomData};
use std::rc;

use crate::interface::{self, Nullish, Sign, Unpacked};

pub trait Policy {
    type Header: PartialEq + Clone;
    type Item;
    fn items_eq(a: &[Self::Item], b: &[Self::Item]) -> bool;
}

pub struct Instance<P: Policy> {
    header: P::Header,
    items: rc::Rc<[P::Item]>,
}

impl<P: Policy> Clone for Instance<P> {
    fn clone(&self) -> Self {
        Self {
            header: self.header.clone(),
            items: self.items.clone(),
        }
    }
}

impl<P: Policy<Header: fmt::Debug, Item: fmt::Debug>> fmt::Debug for Instance<P> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Instance")
            .field("header", &self.header)
            .field("items", &self.items)
            .finish()
    }
}

impl<P: Policy> PartialEq for Instance<P> {
    fn eq(&self, other: &Self) -> bool {
        self.header == other.header && P::items_eq(&*self.items, &*other.items)
    }
}

impl<P: Policy> interface::Instance for Instance<P> {
    type Header = P::Header;
    type Item = P::Item;
    fn new(header: Self::Header, items: impl IntoIterator<Item = Self::Item>) -> Option<Self> {
        Some(Self {
            header,
            items: rc::Rc::from_iter(items),
        })
    }
}

#[derive(Clone)]
pub struct ValuePolicy<H, T>(PhantomData<(H, T)>);

impl<H: PartialEq + Clone, T: PartialEq> Policy for ValuePolicy<H, T> {
    type Header = H;
    type Item = T;
    fn items_eq(a: &[Self::Item], b: &[Self::Item]) -> bool {
        a == b
    }
}

#[derive(Clone)]
pub struct RefPolicy<H, T>(PhantomData<(H, T)>);

impl<H: PartialEq + Clone, T> Policy for RefPolicy<H, T> {
    type Header = H;
    type Item = T;
    fn items_eq(a: &[Self::Item], b: &[Self::Item]) -> bool {
        a.as_ptr() == b.as_ptr()
    }
}

// String

pub type String = Instance<ValuePolicy<(), u16>>;

impl Into<Any> for String {
    fn into(self) -> Any {
        Any(Unpacked::String(self))
    }
}

impl interface::String<Any> for String {}

// BigInt

pub type BigInt = Instance<ValuePolicy<Sign, u64>>;

impl Into<Any> for BigInt {
    fn into(self) -> Any {
        Any(Unpacked::BigInt(self))
    }
}

impl interface::BigInt<Any> for BigInt {}

// Object

pub type Object = Instance<RefPolicy<(), (String, Any)>>;

impl Into<Any> for Object {
    fn into(self) -> Any {
        Any(Unpacked::Object(self))
    }
}

impl interface::Object<Any> for Object {}

// Array

pub type Array = Instance<RefPolicy<(), Any>>;

impl Into<Any> for Array {
    fn into(self) -> Any {
        Any(Unpacked::Array(self))
    }
}

impl interface::Array<Any> for Array {
    fn at(&self, i: usize) -> Any {
        let items = &*self.items;
        if items.len() <= i {
            return Nullish::Undefined.into();
        }
        items[i].clone()
    }
}

// Function

pub type Function = Instance<RefPolicy<u32, u8>>;

impl Into<Any> for Function {
    fn into(self) -> Any {
        Any(Unpacked::Function(self))
    }
}

impl interface::Function<Any> for Function {}

// Any

#[derive(PartialEq, Debug, Clone)]
pub struct Any(Unpacked<Any>);

impl From<interface::Nullish> for Any {
    fn from(value: Nullish) -> Self {
        Self(Unpacked::Nullish(value))
    }
}

impl From<f64> for Any {
    fn from(value: f64) -> Self {
        Self(Unpacked::Number(value))
    }
}

impl From<bool> for Any {
    fn from(value: bool) -> Self {
        Self(Unpacked::Bool(value))
    }
}

impl interface::Any for Any {
    type String = String;
    type Object = Object;
    type Array = Array;
    type BigInt = BigInt;
    type Function = Function;
    fn unpack(self) -> Unpacked<Self> {
        self.0
    }
}

#[cfg(test)]
mod test {
    use interface::Instance;

    use super::*;

    #[test]
    fn test_string() {
        let s0 = String::new((), b"Hello".map(|v| v as u16));
        let s1 = String::new((), b"Hello".map(|v| v as u16));
        let s2 = String::new((), b"world!".map(|v| v as u16));
        assert_eq!(s0, s1);
        assert_ne!(s0, s2);
    }

    #[test]
    fn test_bigint() {
        let b0 = BigInt::new(Sign::Positive, [1, 2, 3]);
        let b1 = BigInt::new(Sign::Positive, [1, 2, 3]);
        let b2 = BigInt::new(Sign::Positive, [1, 2]);
        let b3 = BigInt::new(Sign::Negative, [1, 2, 3]);
        assert_eq!(b0, b1);
        assert_ne!(b1, b2);
        assert_ne!(b0, b3);
    }

    #[test]
    fn test_array() {
        let a = Array::new((), []).unwrap();
        let b = Array::new((), []).unwrap();
        // two empty arrays are not equal
        assert_ne!(a.items.as_ptr(), b.items.as_ptr());
        assert_ne!(a, b);
        //
        assert_eq!(a, a);
    }

    #[test]
    fn test_object() {
        let a = Object::new((), []).unwrap();
        let b = Object::new((), []).unwrap();
        // two empty arrays are not equal
        assert_ne!(a.items.as_ptr(), b.items.as_ptr());
        assert_ne!(a, b);
        //
        assert_eq!(a, a);
    }
}
