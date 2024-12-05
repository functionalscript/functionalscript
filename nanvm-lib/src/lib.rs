/// Future optimization: `fn to_mut(self) -> Option<Mut<Self>>`
pub mod interface {
    #[derive(PartialEq, Debug)]
    pub enum Sign {
        Positive = 1,
        Negative = -1,
    }

    pub trait Instance<A>: Sized + PartialEq {
        type Header;
        type Item;
        fn new(h: Self::Header, c: impl IntoIterator<Item = Self::Item>) -> Option<Self>;
        fn header(&self) -> &Self::Header;
        fn items(&self) -> &[Self::Item];
    }

    pub trait String<A>: Instance<A, Header = (), Item = u16> {}

    pub trait BigInt<A>: Instance<A, Header = Sign, Item = u64> {}

    pub trait Object<A: Any>: Instance<A, Header = (), Item = (A::String, A)> {}

    pub trait Array<A>: Instance<A, Header = (), Item = A> {}

    pub trait Function<A>: Instance<A, Header = u32, Item = u8> {}

    pub trait Any: PartialEq + Sized {
        type String: String<Self>;
        type Object: Object<Self>;
        type Array: Array<Self>;
        type BitInt: BigInt<Self>;
        type Function: Function<Self>;
    }
}

/// Naive implementation of VM.
pub mod naive {
    use core::{fmt, marker::PhantomData};
    use std::rc;

    use crate::interface::{self, Sign};

    pub trait Policy {
        type Header: PartialEq;
        type Item;
        fn items_eq(a: &[Self::Item], b: &[Self::Item]) -> bool;
    }

    pub struct Instance<P: Policy> {
        header: P::Header,
        items: rc::Rc<[P::Item]>,
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

    impl<P: Policy> interface::Instance<Any> for Instance<P> {
        type Header = P::Header;
        type Item = P::Item;
        fn new(header: Self::Header, items: impl IntoIterator<Item = Self::Item>) -> Option<Self> {
            Some(Self {
                header,
                items: rc::Rc::from_iter(items),
            })
        }
        fn header(&self) -> &Self::Header {
            &self.header
        }
        fn items(&self) -> &[Self::Item] {
            &self.items
        }
    }

    pub struct ValuePolicy<H, T>(PhantomData<(H, T)>);

    impl<H: PartialEq, T: PartialEq> Policy for ValuePolicy<H, T> {
        type Header = H;
        type Item = T;
        fn items_eq(a: &[Self::Item], b: &[Self::Item]) -> bool {
            a == b
        }
    }

    pub struct RefPolicy<H, T>(PhantomData<(H, T)>);

    impl<H: PartialEq, T> Policy for RefPolicy<H, T> {
        type Header = H;
        type Item = T;
        fn items_eq(a: &[Self::Item], b: &[Self::Item]) -> bool {
            a.as_ptr() == b.as_ptr()
        }
    }

    pub type String = Instance<ValuePolicy<(), u16>>;

    impl interface::String<Any> for String {}

    pub type BigInt = Instance<ValuePolicy<Sign, u64>>;

    impl interface::BigInt<Any> for BigInt {}

    pub type Object = Instance<RefPolicy<(), (String, Any)>>;

    impl interface::Object<Any> for Object {}

    pub type Array = Instance<RefPolicy<(), Any>>;

    impl interface::Array<Any> for Array {}

    pub type Function = Instance<RefPolicy<u32, u8>>;

    impl interface::Function<Any> for Function {}

    #[derive(Debug, PartialEq)]
    pub enum Any {
        String(String),
        BigInt(BigInt),
        Array(Array),
        Object(Object),
        Function(Function),
    }

    impl interface::Any for Any {
        type String = String;
        type Object = Object;
        type Array = Array;
        type BitInt = BigInt;
        type Function = Function;
    }
}

#[cfg(test)]
mod test {
    use crate::{
        interface::{Instance, Sign},
        naive,
    };

    #[test]
    fn test_string() {
        let s0 = naive::String::new((), b"Hello".map(|v| v as u16));
        let s1 = naive::String::new((), b"Hello".map(|v| v as u16));
        let s2 = naive::String::new((), b"world!".map(|v| v as u16));
        assert_eq!(s0, s1);
        assert_ne!(s0, s2);
    }

    #[test]
    fn test_bigint() {
        let b0 = naive::BigInt::new(Sign::Positive, [1, 2, 3]);
        let b1 = naive::BigInt::new(Sign::Positive, [1, 2, 3]);
        let b2 = naive::BigInt::new(Sign::Positive, [1, 2]);
        let b3 = naive::BigInt::new(Sign::Negative, [1, 2, 3]);
        assert_eq!(b0, b1);
        assert_ne!(b1, b2);
        assert_ne!(b0, b3);
    }

    #[test]
    fn test_array() {
        let a = naive::Array::new((), []).unwrap();
        let b = naive::Array::new((), []).unwrap();
        // two empty arrays are not equal
        assert_ne!(a.items().as_ptr(), b.items().as_ptr());
        assert_ne!(a, b);
        //
        assert_eq!(a, a);
    }

    #[test]
    fn test_object() {
        let a = naive::Object::new((), []).unwrap();
        let b = naive::Object::new((), []).unwrap();
        // two empty arrays are not equal
        assert_ne!(a.items().as_ptr(), b.items().as_ptr());
        assert_ne!(a, b);
        //
        assert_eq!(a, a);
    }
}
