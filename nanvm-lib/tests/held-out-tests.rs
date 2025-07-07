use nanvm_lib::{
    interface::{Any, Complex, Container, Extension, Unpacked, Utf8},
    naive,
    nullish::Nullish,
    serializable::Serializable,
    sign::Sign,
    simple::Simple,
};

fn deep_eq<A: Any>(a: &A, b: &A) -> bool {
    match (a.clone().unpack(), b.clone().unpack()) {
        (Unpacked::Nullish(a), Unpacked::Nullish(b)) => a == b,
        (Unpacked::Bool(a), Unpacked::Bool(b)) => a == b,
        (Unpacked::Number(a), Unpacked::Number(b)) => {
            if a.is_nan() && b.is_nan() {
                true
            } else {
                a.to_bits() == b.to_bits()
            }
        }
        (Unpacked::String16(a), Unpacked::String16(b)) => {
            a.header() == b.header() && a.items() == b.items()
        }
        (Unpacked::BigInt(a), Unpacked::BigInt(b)) => {
            a.header() == b.header() && a.items() == b.items()
        }
        (Unpacked::Array(a), Unpacked::Array(b)) => {
            a.header() == b.header()
                && a.items().len() == b.items().len()
                && a.items().iter().zip(b.items()).all(|(x, y)| deep_eq(x, y))
        }
        (Unpacked::Object(a), Unpacked::Object(b)) => {
            a.header() == b.header()
                && a.items().len() == b.items().len()
                && a.items()
                    .iter()
                    .zip(b.items())
                    .all(|((k1, v1), (k2, v2))| k1.items() == k2.items() && deep_eq(v1, v2))
        }
        _ => false,
    }
}

fn serialization_test<A: Any>(values: &[A]) {
    use std::io::Cursor;

    for value in values.into_iter() {
        let mut buf = Vec::new();
        value.clone().serialize(&mut buf).unwrap();
        let mut cursor = Cursor::new(buf);
        let result = A::deserialize(&mut cursor).unwrap();
        assert!(deep_eq(value, &result));
    }
}

fn serialization<A: Any>() {
    serialization_test(&[
        Simple::Nullish(Nullish::Null).to_unknown(),
        Simple::Nullish(Nullish::Undefined).to_unknown(),
        Simple::Boolean(true).to_unknown(),
        Simple::Boolean(false).to_unknown(),
        Simple::Number(2.3).to_unknown(),
        "Hello".to_unknown(),
        A::BigInt::new(Sign::Positive, [12]).to_unknown(),
        [].to_array_unknown(),
        [Simple::Number(7.0).to_unknown()].to_array_unknown(),
        [
            ("a".to_string16::<A>(), Simple::Number(1.0).to_unknown()),
            ("b".to_string16::<A>(), "c".to_unknown()),
        ]
        .to_object_unknown(),
    ]);
}

#[test]
pub fn test_nullish() {
    serialization_test::<naive::Any>(&[
        Simple::Nullish(Nullish::Null).to_unknown(),
        Simple::Nullish(Nullish::Undefined).to_unknown(),
    ]);
}

#[test]
pub fn test_boolean() {
    serialization_test::<naive::Any>(&[
        Simple::Boolean(true).to_unknown(),
        Simple::Boolean(false).to_unknown(),
    ]);
}

#[test]
pub fn test_number() {
    use std::f64::{INFINITY, NAN};

    serialization_test::<naive::Any>(&[
        Simple::Number(2.3).to_unknown(),
        Simple::Number(-INFINITY).to_unknown(),
        Simple::Number(NAN).to_unknown(),
    ]);
}

#[test]
pub fn test_string() {
    serialization_test::<naive::Any>(&[
        "Hello".to_unknown(),
        "".to_unknown(),
    ]);
}

#[test]
pub fn test_bigint() {
    use nanvm_lib::naive::BigInt;

    serialization_test::<naive::Any>(&[
        BigInt::new(Sign::Positive, [12]).to_unknown(),
        BigInt::new(Sign::Negative, [13, 14]).to_unknown(),
    ]);
}

#[test]
pub fn test_array() {
    serialization_test::<naive::Any>(&[
        [].to_array_unknown(),
        [Simple::Number(7.0).to_unknown()].to_array_unknown(),
    ]);
}

#[test]
pub fn test_object() {
    serialization_test::<naive::Any>(&[
        [].to_object_unknown(),
        [
            ("a".to_string16::<naive::Any>(), Simple::Number(1.0).to_unknown()),
            ("b".to_string16::<naive::Any>(), "c".to_unknown()),
        ]
        .to_object_unknown(),
    ]);
}