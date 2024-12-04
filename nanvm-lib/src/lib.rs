pub mod interface {
    pub enum Sign {
        Positive = 1,
        Negative = -1,
    }

    pub trait VarSize {
        type Header;
        type Item;
        fn new(h: Self::Header, c: impl IntoIterator<Item = Self::Item>) -> Self;
        fn header(&self) -> &Self::Header;
        fn items(&self) -> &[Self::Item];
    }

    pub trait String: VarSize<Header = (), Item = u16> {}

    pub trait BigInt: VarSize<Header = Sign, Item = u64> {}

    pub trait Object: VarSize<Header = (), Item = (<Self::Any as Any>::String, Self::Any)> {
        type Any: Any<Object = Self>;
    }

    pub trait Array: VarSize<Header = (), Item = Self::Any> {
        type Any: Any<Array = Self>;
    }

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

    struct Value<H, T> {
        header: H,
        items: Vec<T>
    }

    #[repr(transparent)]
    pub struct Rc<H, T>(rc::Rc<Value<H, T>>);

    impl<H, T> interface::VarSize for Rc<H, T> {
        type Header = H;
        type Item = T;
        fn new(header: H, s: impl IntoIterator<Item = T>) -> Self {
            Self(rc::Rc::new(Value { header, items: s.into_iter().collect() }))
        }
        fn header(&self) -> &Self::Header {
            &self.0.header
        }
        fn items(&self) -> &[Self::Item] {
            &self.0.items
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
