use crate::interface::{self, Complex};

pub trait Vm {
    type Any: interface::Any;
}

#[repr(transparent)]
pub struct Any<V: Vm>(pub V::Any);

impl<V: Vm> Clone for Any<V>
where
    V::Any: Clone,
{
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<V: Vm> PartialEq for Any<V>
where
    V::Any: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl<V: Vm> core::fmt::Debug for Any<V>
where
    V::Any: core::fmt::Debug,
{
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        self.0.fmt(f)
    }
}

impl<V: Vm> Any<V> {
    pub fn new(v: V::Any) -> Self {
        Self(v)
    }
}

impl<V: Vm> std::ops::Add for Any<V>
where
    V::Any: crate::interface::Any,
{
    type Output = Result<Self, Self>;
    fn add(self, other: Self) -> Self::Output {
        <V::Any as crate::interface::Any>::add(self.0, other.0)
            .map(Self)
            .map_err(Self)
    }
}

impl<V: Vm> std::ops::Sub for Any<V>
where
    V::Any: crate::interface::Any,
{
    type Output = Result<Self, Self>;
    fn sub(self, other: Self) -> Self::Output {
        <V::Any as crate::interface::Any>::sub(self.0, other.0)
            .map(Self)
            .map_err(Self)
    }
}

impl<V: Vm> std::ops::Mul for Any<V>
where
    V::Any: crate::interface::Any,
{
    type Output = Result<Self, Self>;
    fn mul(self, other: Self) -> Self::Output {
        <V::Any as crate::interface::Any>::mul(self.0, other.0)
            .map(Self)
            .map_err(Self)
    }
}

impl<V: Vm> std::ops::Div for Any<V>
where
    V::Any: crate::interface::Any,
{
    type Output = Result<Self, Self>;
    fn div(self, other: Self) -> Self::Output {
        <V::Any as crate::interface::Any>::div(self.0, other.0)
            .map(Self)
            .map_err(Self)
    }
}

impl<V: Vm> std::ops::Shl<Self> for Any<V>
where
    V::Any: crate::interface::Any,
{
    type Output = Result<Self, Self>;
    fn shl(self, other: Self) -> Self::Output {
        <V::Any as crate::interface::Any>::shl(self.0, other.0)
            .map(Self)
            .map_err(Self)
    }
}

impl<V: Vm> std::ops::Shr<Self> for Any<V>
where
    V::Any: crate::interface::Any,
{
    type Output = Result<Self, Self>;
    fn shr(self, other: Self) -> Self::Output {
        <V::Any as crate::interface::Any>::shr(self.0, other.0)
            .map(Self)
            .map_err(Self)
    }
}

#[repr(transparent)]
pub struct String16<V: Vm>(pub <V::Any as crate::interface::Any>::String16);

impl<V: Vm> Clone for String16<V>
where
    <V::Any as interface::Any>::String16: Clone,
{
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<V: Vm> PartialEq for String16<V>
where
    <V::Any as interface::Any>::String16: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl<V: Vm> core::fmt::Debug for String16<V>
where
    <V::Any as interface::Any>::String16: core::fmt::Debug,
{
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        self.0.fmt(f)
    }
}

impl<V: Vm> String16<V> {
    pub fn new(v: <V::Any as crate::interface::Any>::String16) -> Self {
        Self(v)
    }
    pub fn to_any(self) -> Any<V>
    where
        V::Any: crate::interface::Any,
        <V::Any as crate::interface::Any>::String16: crate::interface::Complex<V::Any>,
    {
        Any::new(self.0.to_unknown())
    }
}

#[repr(transparent)]
pub struct Array<V: Vm>(pub <V::Any as crate::interface::Any>::Array);

impl<V: Vm> Clone for Array<V>
where
    <V::Any as interface::Any>::Array: Clone,
{
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<V: Vm> PartialEq for Array<V>
where
    <V::Any as interface::Any>::Array: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl<V: Vm> core::fmt::Debug for Array<V>
where
    <V::Any as interface::Any>::Array: core::fmt::Debug,
{
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        self.0.fmt(f)
    }
}

impl<V: Vm> Array<V> {
    pub fn new(v: <V::Any as crate::interface::Any>::Array) -> Self {
        Self(v)
    }
    pub fn to_any(self) -> Any<V>
    where
        V::Any: crate::interface::Any,
        <V::Any as crate::interface::Any>::Array: crate::interface::Complex<V::Any>,
    {
        Any::new(self.0.to_unknown())
    }
}

#[repr(transparent)]
pub struct Object<V: Vm>(pub <V::Any as crate::interface::Any>::Object);

impl<V: Vm> Clone for Object<V>
where
    <V::Any as interface::Any>::Object: Clone,
{
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<V: Vm> PartialEq for Object<V>
where
    <V::Any as interface::Any>::Object: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl<V: Vm> core::fmt::Debug for Object<V>
where
    <V::Any as interface::Any>::Object: core::fmt::Debug,
{
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        self.0.fmt(f)
    }
}

impl<V: Vm> Object<V> {
    pub fn new(v: <V::Any as crate::interface::Any>::Object) -> Self {
        Self(v)
    }
    pub fn to_any(self) -> Any<V>
    where
        V::Any: crate::interface::Any,
        <V::Any as crate::interface::Any>::Object: crate::interface::Complex<V::Any>,
    {
        Any::new(self.0.to_unknown())
    }
}

#[repr(transparent)]
pub struct BigInt<V: Vm>(pub <V::Any as crate::interface::Any>::BigInt);

impl<V: Vm> Clone for BigInt<V>
where
    <V::Any as interface::Any>::BigInt: Clone,
{
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<V: Vm> PartialEq for BigInt<V>
where
    <V::Any as interface::Any>::BigInt: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl<V: Vm> core::fmt::Debug for BigInt<V>
where
    <V::Any as interface::Any>::BigInt: core::fmt::Debug,
{
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        self.0.fmt(f)
    }
}

impl<V: Vm> BigInt<V> {
    pub fn new(v: <V::Any as crate::interface::Any>::BigInt) -> Self {
        Self(v)
    }
    pub fn to_any(self) -> Any<V>
    where
        V::Any: crate::interface::Any,
        <V::Any as crate::interface::Any>::BigInt: crate::interface::Complex<V::Any>,
    {
        Any::new(self.0.to_unknown())
    }
}

#[repr(transparent)]
pub struct Function<V: Vm>(pub <V::Any as crate::interface::Any>::Function);

impl<V: Vm> Clone for Function<V>
where
    <V::Any as interface::Any>::Function: Clone,
{
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<V: Vm> PartialEq for Function<V>
where
    <V::Any as interface::Any>::Function: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl<V: Vm> core::fmt::Debug for Function<V>
where
    <V::Any as interface::Any>::Function: core::fmt::Debug,
{
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        self.0.fmt(f)
    }
}

impl<V: Vm> Function<V> {
    pub fn new(v: <V::Any as crate::interface::Any>::Function) -> Self {
        Self(v)
    }
    pub fn to_any(self) -> Any<V>
    where
        V::Any: crate::interface::Any,
        <V::Any as crate::interface::Any>::Function: crate::interface::Complex<V::Any>,
    {
        Any::new(self.0.to_unknown())
    }
}
