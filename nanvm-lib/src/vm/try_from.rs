use crate::{
    nullish::Nullish,
    vm::{Any, Array, BigInt, Function, IVm, Object, String16, Unpacked},
};

impl<A: IVm> TryFrom<Any<A>> for Nullish {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Nullish(result) = value.0.to_unpacked() else {
            return Err(());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for bool {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Boolean(result) = value.0.to_unpacked() else {
            return Err(());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for f64 {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Number(result) = value.0.to_unpacked() else {
            return Err(());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for String16<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::String(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Array<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Array(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Object<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Object(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Function<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Function(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for BigInt<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::BigInt(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}
