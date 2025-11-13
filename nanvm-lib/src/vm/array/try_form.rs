use crate::vm::{Any, Array, IVm, Unpacked};

impl<A: IVm> TryFrom<Any<A>> for Array<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Array(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}
