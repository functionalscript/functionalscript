use crate::{
    nullish::Nullish,
    vm::{Any, Array, BigInt, Function, IVm, Object, String, Unpacked},
};

fn error<A: IVm, T>() -> Result<T, Any<A>> {
    Err("Type Error".into())
}

impl<A: IVm> TryFrom<Any<A>> for Nullish {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Nullish(result) = value.into() else {
            return error();
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for bool {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Boolean(result) = value.into() else {
            return error();
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for f64 {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Number(result) = value.into() else {
            return error();
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Array<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Array(result) = value.into() else {
            return error();
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for BigInt<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::BigInt(result) = value.into() else {
            return error();
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Function<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Function(result) = value.into() else {
            return error();
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Object<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Object(result) = value.into() else {
            return error();
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for String<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::String(result) = value.into() else {
            return error();
        };
        Ok(result)
    }
}
