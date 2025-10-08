use crate::{
    common::serializable::Serializable,
    nullish::Nullish,
    vm::{string_coercion::StringCoercion, IVm, String16, Unpacked},
};
use core::fmt::{self, Debug, Formatter};
use std::io::{self, Read, Write};

/// ```
/// use nanvm_lib::{
///     vm::{Any, IVm, ToAny, String16, Array, ToArray, ToObject, Object, BigInt},
///     nullish::Nullish
/// };
/// fn any_test<A: IVm>() {
///     let b: Any<A> = true.to_any();
///     let n: Any<A> = Nullish::Null.to_any();
///     let n: Any<A> = 42.0.to_any();
///     let c: String16<A> = "Hello".into();
///     let m: Any<A> = c.to_any();
///     let a: Array<A> = [].to_array();
///     let o: Any<A> = a.to_any();
///     let x: Object<A> = [].to_object();
///     let p: Any<A> = x.to_any();
///     let u: BigInt<A> = 123u64.into();
///     let q: Any<A> = u.to_any();
/// }
/// ```
#[derive(Clone)]
pub struct Any<A: IVm>(A);

impl<A: IVm> Debug for Any<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        self.0.clone().to_unpacked().fmt(f)
    }
}

pub trait ToAny {
    fn to_any<A: IVm>(self) -> Any<A>
    where
        Self: Into<A>,
    {
        Any(self.into())
    }
}

impl<T> ToAny for T {}

/// Same as `===` in ECMAScript.
impl<A: IVm> PartialEq for Any<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.clone().to_unpacked() == other.0.clone().to_unpacked()
    }
}

impl<A: IVm> From<Any<A>> for Unpacked<A> {
    fn from(value: Any<A>) -> Self {
        value.0.to_unpacked()
    }
}

impl<A: IVm> From<Unpacked<A>> for Any<A> {
    fn from(value: Unpacked<A>) -> Self {
        match value {
            Unpacked::Nullish(n) => n.to_any(),
            Unpacked::Boolean(b) => b.to_any(),
            Unpacked::Number(n) => n.to_any(),
            Unpacked::String(s) => s.to_any(),
            Unpacked::BigInt(i) => i.to_any(),
            Unpacked::Object(o) => o.to_any(),
            Unpacked::Array(a) => a.to_any(),
            Unpacked::Function(f) => f.to_any(),
        }
    }
}

impl<A: IVm> TryFrom<Any<A>> for Nullish {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Nullish(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> TryFrom<Any<A>> for bool {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Boolean(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> TryFrom<Any<A>> for f64 {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Number(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> Serializable for Any<A> {
    fn serialize(self, write: &mut impl Write) -> io::Result<()> {
        self.0.to_unpacked().serialize(write)
    }
    fn deserialize(read: &mut impl Read) -> io::Result<Self> {
        Ok(Unpacked::deserialize(read)?.into())
    }
}

impl<A: IVm> StringCoercion<A> for Any<A> {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        self.0.to_unpacked().coerce_to_string()
    }
}
