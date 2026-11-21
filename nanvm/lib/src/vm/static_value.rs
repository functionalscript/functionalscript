use crate::{
    sign::Sign,
    vm::{Any, Array, BigInt, Function, IVm, Nullish, Object, StaticCode, String, ToAny},
};

pub struct StaticString(pub &'static [u16]);

/// Canonical little-endian magnitude with no high zero word. Zero has no words and a positive sign.
pub struct StaticBigInt {
    pub sign: Sign,
    pub words: &'static [u64],
}

pub struct StaticArray<A: IVm>(pub &'static [StaticAny<A>]);
/// Own properties in VM enumeration order, with unique keys.
pub struct StaticObject<A: IVm>(pub &'static [(&'static StaticString, StaticAny<A>)]);
pub struct StaticFunction<A: IVm> {
    pub code: StaticCode<A>,
    pub length: u32,
    pub frame: &'static StaticArray<A>,
    pub text: Option<&'static str>,
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
        vm::{IComplex, ToArray},
    };

    fn capture(
        self_: &<Naive as IVm>::InternalFunction,
        _: Array<Naive>,
    ) -> Result<Any<Naive>, Any<Naive>> {
        Ok(Naive::frame(self_)[0].clone())
    }

    static FRAME: StaticArray<Naive> = StaticArray(&[StaticAny::Number(42.0)]);
    static FUNCTION: StaticFunction<Naive> = StaticFunction {
        code: capture,
        frame: &FRAME,
        length: 1,
        text: Some("x => captured"),
    };
    static MODULE: StaticObject<Naive> =
        StaticObject(&[(&StaticString(&[102]), StaticAny::Function(&FUNCTION))]);
    static EMPTY: StaticObject<Naive> = StaticObject(&[]);
    static OTHER_EMPTY: StaticObject<Naive> = StaticObject(&[]);

    #[test]
    fn load_module_and_call_captured_function() {
        let module = Object::from_static(&MODULE);
        let again = Object::from_static(&MODULE);
        assert_eq!(module, again);
        assert_eq!(module[0].0, "f".into());
        let f = Function::try_from(module[0].1.clone()).unwrap();
        assert_eq!(f, Function::from_static(&FUNCTION));
        assert_eq!(f.to_any(), again[0].1);
        let f = Function::from_static(&FUNCTION);
        assert_eq!(f.length(), 1);
        assert_eq!(f.text(), Ok("x => captured".into()));
        assert_eq!(f.call([].to_array()), Ok(42.0.to_any()));
        assert_ne!(
            Object::from_static(&EMPTY),
            Object::from_static(&OTHER_EMPTY)
        );
        assert_eq!(
            Naive::load_object(&EMPTY).address(),
            core::ptr::addr_of!(EMPTY) as usize
        );
        assert_eq!(Array::from_static(&FRAME), Array::from_static(&FRAME));
    }

    #[test]
    fn primitive_constants_use_runtime_value_semantics() {
        static BIG: StaticBigInt = StaticBigInt {
            sign: Sign::Negative,
            words: &[42],
        };
        let fixtures: [(StaticAny<Naive>, Any<Naive>); 5] = [
            (StaticAny::BigInt(&BIG), BigInt::from(-42_i64).to_any()),
            (StaticAny::String(&StaticString(&[0x61])), "a".into()),
            (StaticAny::Number(-0.0), (-0.0).to_any()),
            (StaticAny::Boolean(false), false.to_any()),
            (StaticAny::Nullish(Nullish::Undefined), Any::undefined()),
        ];
        for (descriptor, expected) in fixtures {
            assert!(descriptor.load().same_value(&expected));
        }
    }
}
