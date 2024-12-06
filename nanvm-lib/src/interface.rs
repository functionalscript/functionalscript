/// Future optimization: `fn to_mut(self) -> Option<Mut<Self>>`

#[derive(Debug, PartialEq, Clone)]
pub enum Nullish {
    Null,
    Undefined,
}

#[derive(PartialEq, Debug, Clone)]
pub enum Sign {
    Positive = 1,
    Negative = -1,
}

pub trait List: Sized + PartialEq + Clone {
    type Item;
    fn new(list: impl IntoIterator<Item = Self::Item>) -> Self;
}

pub trait PrefixList: Sized + PartialEq + Clone {
    type Prefix;
    type Item;
    fn new(prefix: Self::Prefix, list: impl IntoIterator<Item = Self::Item>) -> Self;
}

pub trait String<A>: List<Item = u16> + Into<A> {}

pub trait BigInt<A>: PrefixList<Prefix = Sign, Item = u64> + Into<A> {}

pub trait Object<A: Any>: List<Item = (A::String, A)> + Into<A> {}

pub trait Array<A>: List<Item = A> + Into<A> {}

pub trait Function<A>: PrefixList<Prefix = u32, Item = u8> + Into<A> {}

pub trait Any: PartialEq + Sized + From<f64> + From<bool> + From<Nullish> + Clone {
    type String: String<Self>;
    type Object: Object<Self>;
    type Array: Array<Self>;
    type BigInt: BigInt<Self>;
    type Function: Function<Self>;
    fn unpack(self) -> Unpacked<Self>;
}

#[derive(PartialEq, Debug, Clone)]
pub enum Unpacked<A: Any> {
    Nullish(Nullish),
    Bool(bool),
    Number(f64),
    String(A::String),
    BigInt(A::BigInt),
    Array(A::Array),
    Object(A::Object),
    Function(A::Function),
}
