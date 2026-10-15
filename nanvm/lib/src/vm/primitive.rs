use crate::vm::{Any, BigInt, IVm, Number, String, Unpacked, nullish::Nullish};

/// <https://developer.mozilla.org/en-US/docs/Glossary/Primitive>
/// A primitive value is a subset of Unpacked that excludes Object, Array, and Function.
///
/// `Debug` and `PartialEq` go through `Unpacked` (`vm/impls/`): deriving
/// them would bound `A` itself, which no VM promises.
#[allow(dead_code)]
#[derive(Clone)]
pub enum Primitive<A: IVm> {
    Nullish(Nullish),
    Boolean(bool),
    Number(Number),
    String(String<A>),
    BigInt(BigInt<A>),
}

impl<A: IVm> From<Primitive<A>> for Unpacked<A> {
    fn from(value: Primitive<A>) -> Self {
        match value {
            Primitive::Nullish(n) => Unpacked::Nullish(n),
            Primitive::Boolean(b) => Unpacked::Boolean(b),
            Primitive::Number(n) => Unpacked::Number(n),
            Primitive::String(s) => Unpacked::String(s),
            Primitive::BigInt(i) => Unpacked::BigInt(i),
        }
    }
}

impl<A: IVm> From<Primitive<A>> for Any<A> {
    fn from(value: Primitive<A>) -> Self {
        Unpacked::from(value).into()
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Number, nullish::Nullish, primitive::Primitive},
    };

    type A = Naive;

    #[test]
    fn eq() {
        let s = Primitive::<A>::String("x".into());
        assert_eq!(s, s.clone());
        assert_ne!(s, Primitive::String("y".into()));
        assert_eq!(
            Primitive::<A>::Number(Number::from(1.0)),
            Primitive::Number(Number::from(1.0))
        );
        assert_ne!(
            Primitive::<A>::Nullish(Nullish::Null),
            Primitive::Nullish(Nullish::Undefined)
        );
        assert_ne!(
            Primitive::<A>::Boolean(true),
            Primitive::Number(Number::from(1.0))
        );
    }

    #[test]
    fn debug() {
        assert_eq!(format!("{:?}", Primitive::<A>::String("x".into())), "\"x\"");
        assert_eq!(format!("{:?}", Primitive::<A>::Boolean(true)), "true");
        assert_eq!(
            format!("{:?}", Primitive::<A>::Nullish(Nullish::Null)),
            "Null"
        );
    }
}
