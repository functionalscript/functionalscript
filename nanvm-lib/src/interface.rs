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

pub trait Instance: Sized + PartialEq + Clone {
    type Header;
    type Item;
    fn new(h: Self::Header, c: impl IntoIterator<Item = Self::Item>) -> Option<Self>;
}

pub trait String<A>: Instance<Header = (), Item = u16> + Into<A> {}

pub trait BigInt<A>: Instance<Header = Sign, Item = u64> + Into<A> {}

pub trait Object<A: Any>: Instance<Header = (), Item = (A::String, A)> + Into<A> {}

pub trait Array<A>: Instance<Header = (), Item = A> + Into<A> {
    fn at(&self, i: usize) -> A;
}

pub trait Function<A>: Instance<Header = u32, Item = u8> + Into<A> {}

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
