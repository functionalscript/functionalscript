pub mod interface {
    pub enum Sign {
        Positive = 1,
        Negative = -1,
    }

    pub trait VarSize {
        type Header;
        type Item;
        fn new(h: Self::Header, c: impl IntoIterator<Item = Self::Item>) -> Self;
    }

    pub trait String: VarSize<Header = (), Item = u16> {}

    pub trait BigInt: VarSize<Header = Sign, Item = u64> {}

    pub trait Object {}

    pub trait Array {}

    pub trait Function {}

    pub trait Any {
        type String: String;
        type Object: Object;
        type Array: Array;
        type BitInt: BigInt;
        type Function: Function;
    }
}

pub mod simple {
    use std::rc;

    use crate::interface::{self, Sign};

    #[repr(transparent)]
    pub struct Rc<H, T>(rc::Rc<(H, Vec<T>)>);

    impl<H, T> interface::VarSize for Rc<H, T> {
        type Header = H;
        type Item = T;
        fn new(h: H, s: impl IntoIterator<Item = T>) -> Self {
            Self(rc::Rc::new((h, s.into_iter().collect())))
        }
    }

    pub type String = Rc<(), u16>;

    pub type BigInt = Rc<Sign, u64>;

    type Object = Rc<(), (String, Any)>;

    type Array = Rc<(), Any>;

    type Function = Rc<u32, u8>;

    pub enum Any {
        String(String),
        BigInt(BigInt),
        Array(Array),
        Object(Object),
        Function(Function),
    }
}

#[cfg(test)]
mod test {
    use crate::{
        interface::{Sign, VarSize},
        simple,
    };

    #[test]
    fn test() {
        let s = simple::String::new((), b"Hello".map(|v| v as u16));
        let bi = simple::BigInt::new(Sign::Positive, [15]);
    }
}
