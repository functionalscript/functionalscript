use crate::{big_int, big_uint, interface, sign::Sign, simple::Simple};
use core::{fmt, marker::PhantomData};
use std::{cell::RefCell, rc};

pub trait Policy {
    type Header: PartialEq + fmt::Debug + Clone + Default;
    type Item: fmt::Debug + Clone + Default;
    fn items_eq(a: &rc::Rc<RefCell<Vec<Self::Item>>>, b: &rc::Rc<RefCell<Vec<Self::Item>>>)
        -> bool;
}

#[derive(Clone, Default)]
pub struct ValuePolicy<H, T>(PhantomData<(H, T)>);

impl<H: PartialEq + fmt::Debug + Clone + Default, T: Clone + PartialEq + fmt::Debug + Default>
    Policy for ValuePolicy<H, T>
{
    type Header = H;
    type Item = T;
    fn items_eq(
        a: &rc::Rc<RefCell<Vec<Self::Item>>>,
        b: &rc::Rc<RefCell<Vec<Self::Item>>>,
    ) -> bool {
        a == b
    }
}

#[derive(Clone)]
pub struct RefPolicy<H, T: Clone>(PhantomData<(H, T)>);

impl<H: PartialEq + fmt::Debug + Clone + Default, T: fmt::Debug + Clone + Default> Policy
    for RefPolicy<H, T>
{
    type Header = H;
    type Item = T;
    fn items_eq(
        a: &rc::Rc<RefCell<Vec<Self::Item>>>,
        b: &rc::Rc<RefCell<Vec<Self::Item>>>,
    ) -> bool {
        a.as_ptr() == b.as_ptr()
    }
}

pub struct Complex<P: Policy> {
    header: P::Header,
    items: rc::Rc<RefCell<Vec<P::Item>>>,
}

impl<P: Policy> Clone for Complex<P> {
    fn clone(&self) -> Self {
        Self {
            header: self.header.clone(),
            items: self.items.clone(),
        }
    }
}

impl<P: Policy + Default> Default for Complex<P> {
    fn default() -> Self {
        Self {
            header: P::Header::default(),
            items: rc::Rc::new(RefCell::new(vec![P::Item::default()])),
        }
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

impl<P: Policy> interface::Container for Complex<P> {
    type Header = P::Header;
    type Item = P::Item;
    fn header(&self) -> &Self::Header {
        &self.header
    }
    fn set_header(&mut self, header: Self::Header) {
        self.header = header;
    }
    fn set_item(&mut self, index: usize, item: Self::Item) {
        self.items.borrow_mut()[index] = item;
    }
    fn items(&self) -> std::cell::Ref<Vec<Self::Item>> {
        self.items.borrow()
    }
    fn pop_last_item(&mut self) {
        self.items.borrow_mut().pop();
    }
    fn new(header: Self::Header, items: &[Self::Item]) -> Self {
        Self {
            header,
            items: rc::Rc::new(RefCell::new(items.to_vec())),
        }
    }
    fn new_sized(header: Self::Header, size: usize) -> Self {
        Self {
            header,
            items: rc::Rc::new(RefCell::new(vec![P::Item::default(); size])),
        }
    }
}

// String

pub type String16 = Complex<ValuePolicy<(), u16>>;

impl interface::Complex<Any> for String16 {
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

impl interface::String16<Any> for String16 {}

// BigInt

pub type BigInt = Complex<ValuePolicy<Sign, u64>>;

impl interface::Complex<Any> for BigInt {
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

impl big_uint::BigUint<Sign> for BigInt {}
impl big_int::BigInt<Any> for BigInt {}

// Array

pub type Array = Complex<RefPolicy<(), Any>>;

impl interface::Complex<Any> for Array {
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

impl interface::Array<Any> for Array {}

// Object

pub type Object = Complex<RefPolicy<(), (String16, Any)>>;

impl interface::Complex<Any> for Object {
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

impl interface::Object<Any> for Object {}

// Function

pub type Function = Complex<RefPolicy<u32, u8>>;

impl interface::Complex<Any> for Function {
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

impl interface::Function<Any> for Function {}

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

impl Default for Any {
    fn default() -> Self {
        Any::Simple(Simple::default())
    }
}

impl interface::Any for Any {
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

    fn pack(u: interface::Unpacked<Self>) -> Self {
        match u {
            interface::Unpacked::Nullish(n) => Self::Simple(Simple::Nullish(n)),
            interface::Unpacked::Bool(n) => Self::Simple(Simple::Boolean(n)),
            interface::Unpacked::Number(n) => Self::Simple(Simple::Number(n)),
            interface::Unpacked::String16(n) => Self::String16(n),
            interface::Unpacked::BigInt(n) => Self::BigInt(n),
            interface::Unpacked::Array(n) => Self::Array(n),
            interface::Unpacked::Object(n) => Self::Object(n),
            interface::Unpacked::Function(n) => Self::Function(n),
        }
    }

    fn unpack(self) -> interface::Unpacked<Self> {
        match self {
            Any::Simple(Simple::Nullish(n)) => interface::Unpacked::Nullish(n),
            Any::Simple(Simple::Boolean(n)) => interface::Unpacked::Bool(n),
            Any::Simple(Simple::Number(n)) => interface::Unpacked::Number(n),
            Any::String16(complex) => interface::Unpacked::String16(complex),
            Any::BigInt(complex) => interface::Unpacked::BigInt(complex),
            Any::Array(complex) => interface::Unpacked::Array(complex),
            Any::Object(complex) => interface::Unpacked::Object(complex),
            Any::Function(complex) => interface::Unpacked::Function(complex),
        }
    }

    fn try_to<C: interface::Complex<Self>>(self) -> Result<C, Self> {
        C::try_from_unknown(self)
    }
}
