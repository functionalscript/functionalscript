use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{Any, Array, BigInt, Function, IVm, Nullish, Object, StaticCode, String, ToAny},
};

/// A string constant, in the form its descriptor was written in. A VM reads
/// either through [`SizedIndex`] and need not widen the ASCII form.
pub enum StaticString {
    Utf16(&'static [u16]),
    /// One code unit per byte. Every byte is below `0x80`, which nothing checks
    /// when it is read: [`ascii`] is the checked way to write one.
    Ascii(&'static [u8]),
}

pub const fn utf16(units: &'static [u16]) -> StaticString {
    StaticString::Utf16(units)
}

/// Refuses a non-ASCII character, when the `static` it initializes is compiled.
pub const fn ascii(text: &'static str) -> StaticString {
    assert!(text.is_ascii());
    StaticString::Ascii(text.as_bytes())
}

impl SizedIndex<usize> for StaticString {
    type Output = u16;
    fn length(&self) -> usize {
        match self {
            Self::Utf16(units) => units.len(),
            Self::Ascii(bytes) => bytes.len(),
        }
    }
    fn item(&self, i: usize) -> u16 {
        match self {
            Self::Utf16(units) => units[i],
            Self::Ascii(bytes) => bytes[i].into(),
        }
    }
}

/// Canonical little-endian magnitude with no high zero word. Zero has no words and a positive sign.
pub struct StaticBigInt {
    pub sign: Sign,
    pub words: &'static [u64],
}

pub struct StaticArray<A: IVm>(pub &'static [StaticAny<A>]);
/// Own properties in VM enumeration order, with unique keys.
pub struct StaticObject<A: IVm>(pub &'static [(&'static StaticString, StaticAny<A>)]);
/// A module function whose code refers directly to its captured constants.
pub struct StaticFunction<A: IVm> {
    pub code: StaticCode<A>,
    pub length: u32,
    pub text: Option<&'static StaticString>,
}

/// A module constant. Identity-bearing values refer to named static descriptors.
pub enum StaticAny<A: IVm> {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
    String(&'static StaticString),
    BigInt(&'static StaticBigInt),
    Array(&'static StaticArray<A>),
    Object(&'static StaticObject<A>),
    Function(&'static StaticFunction<A>),
}

impl<A: IStaticVm> StaticAny<A> {
    pub fn load(&self) -> Any<A> {
        match self {
            Self::Nullish(v) => (*v).to_any(),
            Self::Boolean(v) => (*v).to_any(),
            Self::Number(v) => (*v).to_any(),
            Self::String(v) => String::from_static(v).to_any(),
            Self::BigInt(v) => BigInt::from_static(v).to_any(),
            Self::Array(v) => Array::from_static(v).to_any(),
            Self::Object(v) => Object::from_static(v).to_any(),
            Self::Function(v) => Function::from_static(v).to_any(),
        }
    }
}

/// Loads compiled constants. Repeated loads of one array, object or function
/// have the same identity. Distinct named descriptors have distinct identities.
pub trait IStaticVm: IVm {
    fn load_string(value: &'static StaticString) -> Self::InternalString;
    fn load_bigint(value: &'static StaticBigInt) -> Self::InternalBigInt;
    fn load_array(value: &'static StaticArray<Self>) -> Self::InternalArray;
    fn load_object(value: &'static StaticObject<Self>) -> Self::InternalObject;
    fn load_function(value: &'static StaticFunction<Self>) -> Self::InternalFunction;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        naive::Naive,
        vm::{IComplex, ToArray, ToString},
    };

    static CAPTURED: StaticArray<Naive> = StaticArray(&[StaticAny::Number(42.0)]);
    static FUNCTION: StaticFunction<Naive> = StaticFunction {
        code: |_, _| Ok(Array::from_static(&CAPTURED).to_any()),
        length: 1,
        text: Some(&ascii("x => captured")),
    };
    static MODULE: StaticObject<Naive> =
        StaticObject(&[(&utf16(&[0x66]), StaticAny::Function(&FUNCTION))]);
    static EMPTY: StaticObject<Naive> = StaticObject(&[]);
    static OTHER_EMPTY: StaticObject<Naive> = StaticObject(&[]);

    #[test]
    fn load_module_and_call_captured_function() {
        let module = Object::from_static(&MODULE);
        let again = Object::from_static(&MODULE);
        assert_eq!(module, again);
        assert_eq!(module.property_at(0).0, "f".into());
        let f = Function::try_from(module.property_at(0).1).unwrap();
        assert_eq!(f, Function::from_static(&FUNCTION));
        assert_eq!(f.to_any(), again.property_at(0).1);
        let f = Function::from_static(&FUNCTION);
        assert_eq!(f.length(), 1);
        assert_eq!(f.text(), Ok("x => captured".into()));
        assert_eq!(
            f.call([].to_array()),
            Ok(Array::from_static(&CAPTURED).to_any())
        );
        assert_ne!(
            Object::from_static(&EMPTY),
            Object::from_static(&OTHER_EMPTY)
        );
        assert_eq!(
            Naive::load_object(&EMPTY).address(),
            core::ptr::addr_of!(EMPTY) as usize
        );
    }

    #[test]
    fn static_self_has_descriptor_identity() {
        static SELF: StaticFunction<Naive> = StaticFunction {
            code: |_, _| Ok(Function::from_static(&SELF).to_any()),
            length: 0,
            text: None,
        };
        static OTHER: StaticFunction<Naive> = StaticFunction { ..SELF };
        let f = Function::from_static(&SELF);
        assert!(Naive::frame(f.internal()).is_empty());
        assert_eq!(f.call([].to_array()), Ok(f.clone().to_any()));
        assert_ne!(f, Function::from_static(&OTHER));
        assert_ne!(f, Naive::static_function(SELF.code, 0, [].to_array(), None));
        assert!(f.text().is_err());
    }

    #[test]
    fn static_functions_name_one_another_by_descriptor() {
        static FIRST: StaticFunction<Naive> = StaticFunction {
            code: |_, _| Ok(Function::from_static(&SECOND).to_any()),
            length: 0,
            text: None,
        };
        static SECOND: StaticFunction<Naive> = StaticFunction {
            code: |_, _| Ok(Function::from_static(&FIRST).to_any()),
            length: 0,
            text: None,
        };
        let first = Function::from_static(&FIRST);
        let second = Function::from_static(&SECOND);
        assert_ne!(first, second);
        assert_eq!(first.call([].to_array()), Ok(second.clone().to_any()));
        assert_eq!(second.call([].to_array()), Ok(first.clone().to_any()));
    }

    #[test]
    fn static_object_reads_return_owned_values_with_descriptor_identity() {
        let key = String::<Naive>::from("f");
        let (name, value) = Object::from_static(&MODULE).property_at(0);
        assert_eq!(name, key);
        assert_eq!(
            Object::from_static(&MODULE).own_property(&key),
            Some(value.clone())
        );
        assert_eq!(
            Object::from_static(&MODULE).own_property(&"missing".into()),
            None
        );
        static ASCII: StaticObject<Naive> = StaticObject(&[(&ascii("ab"), StaticAny::Number(1.0))]);
        let ascii = Object::from_static(&ASCII);
        assert_eq!(ascii.property_at(0).0, "ab".into());
        assert_eq!(ascii.own_property(&"ab".into()), Some(1.0.to_any()));
        for missing in ["a", "abc", "ac"] {
            assert_eq!(ascii.own_property(&missing.into()), None);
        }
        let mut properties = Object::from_static(&MODULE).into_iter();
        assert_eq!(properties.len(), 1);
        assert_eq!(properties.next(), Some((name, value)));
        assert_eq!(properties.len(), 0);
        assert_eq!(properties.next(), None);
    }

    #[test]
    fn primitive_constants_use_runtime_value_semantics() {
        static BIG: StaticBigInt = StaticBigInt {
            sign: Sign::Negative,
            words: &[42],
        };
        let fixtures: [(StaticAny<Naive>, Any<Naive>); 7] = [
            (StaticAny::BigInt(&BIG), BigInt::from(-42_i64).to_any()),
            (
                StaticAny::String(const { &utf16(&[0x61, 0xd800]) }),
                [0x61, 0xd800].to_string().to_any(),
            ),
            (StaticAny::String(const { &ascii("a\x7f") }), "a\x7f".into()),
            (StaticAny::String(const { &ascii("") }), "".into()),
            (StaticAny::Number(-0.0), (-0.0).to_any()),
            (StaticAny::Boolean(false), false.to_any()),
            (StaticAny::Nullish(Nullish::Undefined), Any::undefined()),
        ];
        for (descriptor, expected) in fixtures {
            assert!(descriptor.load().same_value(&expected));
        }
    }
}
