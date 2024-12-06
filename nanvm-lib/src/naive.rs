/// Naive implementation of VM.
use core::{fmt, marker::PhantomData};
use std::rc;

use crate::{interface::{self, Unpacked}, nullish::Nullish, sign::Sign};

pub trait Policy {
    type Prefix: PartialEq + Clone;
    type Item;
    fn list_eq(a: &[Self::Item], b: &[Self::Item]) -> bool;
}

pub struct Instance<P: Policy> {
    prefix: P::Prefix,
    list: rc::Rc<[P::Item]>,
}

impl<P: Policy> Clone for Instance<P> {
    fn clone(&self) -> Self {
        Self {
            prefix: self.prefix.clone(),
            list: self.list.clone(),
        }
    }
}

impl<P: Policy<Prefix: fmt::Debug, Item: fmt::Debug>> fmt::Debug for Instance<P> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Instance")
            .field("prefix", &self.prefix)
            .field("list", &self.list)
            .finish()
    }
}

impl<P: Policy> PartialEq for Instance<P> {
    fn eq(&self, other: &Self) -> bool {
        self.prefix == other.prefix && P::list_eq(&*self.list, &*other.list)
    }
}

impl<P: Policy> interface::PrefixList for Instance<P> {
    type Prefix = P::Prefix;
    type Item = P::Item;
    fn new(prefix: Self::Prefix, list: impl IntoIterator<Item = Self::Item>) -> Self {
        Self {
            prefix,
            list: rc::Rc::from_iter(list),
        }
    }
}

impl<P: Policy<Prefix = ()>> interface::List for Instance<P> {
    type Item = P::Item;
    fn new(c: impl IntoIterator<Item = Self::Item>) -> Self {
        <Self as interface::PrefixList>::new((), c)
    }
}

#[derive(Clone)]
pub struct ValuePolicy<H, T>(PhantomData<(H, T)>);

impl<H: PartialEq + Clone, T: PartialEq> Policy for ValuePolicy<H, T> {
    type Prefix = H;
    type Item = T;
    fn list_eq(a: &[Self::Item], b: &[Self::Item]) -> bool {
        a == b
    }
}

#[derive(Clone)]
pub struct RefPolicy<H, T>(PhantomData<(H, T)>);

impl<H: PartialEq + Clone, T> Policy for RefPolicy<H, T> {
    type Prefix = H;
    type Item = T;
    fn list_eq(a: &[Self::Item], b: &[Self::Item]) -> bool {
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

impl interface::Object<Any> for Object {
    /*
    fn own(&self, i: String) -> Any {
        match self.items.into_iter().find(|v| v.0 == i) {
            Some(v) => v.1.clone(),
            None => Nullish::Undefined.into(),
        }
    }
    */
}

// Array

pub type Array = Instance<RefPolicy<(), Any>>;

impl Into<Any> for Array {
    fn into(self) -> Any {
        Any(Unpacked::Array(self))
    }
}

impl interface::Array<Any> for Array {
    /*
    fn at(&self, n: f64) -> Any {
        let items = &*self.items;
        let i = n as usize;
        if i as f64 == n && i < items.len() {
            items[i].clone()
        } else {
            Nullish::Undefined.into()
        }
    }
    */
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

impl From<Nullish> for Any {
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
    /*
    fn own_property(&self, index: Self) -> Self {
        match self.items.into_iter().find(|v| v.0 == i) {
            Some(v) => v.1.clone(),
            None => Nullish::Undefined.into(),
        }
    }
    */
}

#[cfg(test)]
mod test {
    use interface::PrefixList;

    use crate::sign::Sign;

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
        let a = Array::new((), []);
        let b = Array::new((), []);
        // two empty arrays are not equal
        assert_ne!(a.list.as_ptr(), b.list.as_ptr());
        assert_ne!(a, b);
        //
        assert_eq!(a, a);
    }

    #[test]
    fn test_object() {
        let a = Object::new((), []);
        let b = Object::new((), []);
        // two empty arrays are not equal
        assert_ne!(a.list.as_ptr(), b.list.as_ptr());
        assert_ne!(a, b);
        //
        assert_eq!(a, a);
    }
}
