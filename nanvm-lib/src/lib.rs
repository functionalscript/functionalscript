pub mod interface;
pub mod naive;

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
