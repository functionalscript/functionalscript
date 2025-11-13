use crate::{
    nullish::Nullish,
    vm::{Any, IVm, Unpacked},
};

impl<A: IVm> TryFrom<Any<A>> for Nullish {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Nullish(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for bool {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Boolean(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for f64 {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Number(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}
