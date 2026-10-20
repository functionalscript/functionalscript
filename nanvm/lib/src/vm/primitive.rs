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

/// The inverse of `From<Primitive<A>> for Unpacked<A>`: an object, an array
/// or a function is not a primitive and comes back unchanged.
impl<A: IVm> TryFrom<Unpacked<A>> for Primitive<A> {
    type Error = Unpacked<A>;

    fn try_from(value: Unpacked<A>) -> Result<Self, Self::Error> {
        match value {
            Unpacked::Nullish(n) => Ok(Primitive::Nullish(n)),
            Unpacked::Boolean(b) => Ok(Primitive::Boolean(b)),
            Unpacked::Number(n) => Ok(Primitive::Number(n)),
            Unpacked::String(s) => Ok(Primitive::String(s)),
            Unpacked::BigInt(i) => Ok(Primitive::BigInt(i)),
            v @ (Unpacked::Object(_) | Unpacked::Array(_) | Unpacked::Function(_)) => Err(v),
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
        vm::{BigInt, Number, ToArray, Unpacked, nullish::Nullish, primitive::Primitive},
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

    /// Each primitive comes back from `Unpacked` as itself; an array, as an
    /// object or a function would, comes back unchanged as the error.
    #[test]
    fn try_from_unpacked() {
        let bi: BigInt<A> = 7i64.into();
        for p in [
            Primitive::<A>::Nullish(Nullish::Undefined),
            Primitive::Boolean(false),
            Primitive::Number(Number::from(2.5)),
            Primitive::String("x".into()),
            Primitive::BigInt(bi),
        ] {
            assert_eq!(Primitive::try_from(Unpacked::from(p.clone())), Ok(p));
        }
        let a = Unpacked::<A>::Array([].to_array());
        assert_eq!(Primitive::try_from(a.clone()), Err(a));
    }
}
