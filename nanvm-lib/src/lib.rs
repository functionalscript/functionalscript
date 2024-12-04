/// Future optimization: `fn to_mut(self) -> Option<Mut<Self>>`
pub mod interface {
    #[derive(PartialEq)]
    pub enum Sign {
        Positive = 1,
        Negative = -1,
    }

    pub trait Instance: Sized {
        type Header;
        type Item;
        fn new(h: Self::Header, c: impl IntoIterator<Item = Self::Item>) -> Option<Self>;
        fn header(&self) -> &Self::Header;
        fn items(&self) -> &[Self::Item];
    }

    pub trait String: Instance<Header = (), Item = u16> {}

    pub trait BigInt: Instance<Header = Sign, Item = u64> {}

    pub trait Object:
        Instance<Header = (), Item = (<Self::Any as Any>::String, Self::Any)>
    {
        type Any: Any<Object = Self>;
    }

    pub trait Array: Instance<Header = (), Item = Self::Any> {
        type Any: Any<Array = Self>;
    }

    pub trait Function: Instance<Header = u32, Item = u8> {}

    pub trait Any {
        type String: String;
        type Object: Object;
        type Array: Array;
        type BitInt: BigInt;
        type Function: Function;
    }
}

/// Naive implementation of VM.
pub mod naive {
    use std::rc;

    use crate::interface::{self, Sign};

    pub struct Instance<H, T> {
        header: H,
        items: rc::Rc<[T]>,
    }

    impl<H: PartialEq, T> interface::Instance for Instance<H, T> {
        type Header = H;
        type Item = T;
        fn new(header: H, s: impl IntoIterator<Item = T>) -> Option<Self> {
            Some(Self {
                header,
                items: rc::Rc::from_iter(s),
            })
        }
        fn header(&self) -> &Self::Header {
            &self.header
        }
        fn items(&self) -> &[Self::Item] {
            &self.items
        }
    }

    pub type String = Instance<(), u16>;

    pub type BigInt = Instance<Sign, u64>;

    type Object = Instance<(), (String, Any)>;

    pub type Array = Instance<(), Any>;

    type Function = Instance<u32, u8>;

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
        interface::{Instance, Sign},
        naive,
    };

    #[test]
    fn test() {
        let s = naive::String::new((), b"Hello".map(|v| v as u16));
        let bi = naive::BigInt::new(Sign::Positive, []);
        {
            let a = naive::Array::new((), []).unwrap();
            let b = naive::Array::new((), []).unwrap();
            // two empty arrays are not equal
            assert_ne!(a.items().as_ptr(), b.items().as_ptr());
        }
    }
}
