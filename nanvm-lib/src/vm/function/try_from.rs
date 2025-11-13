use crate::vm::{Any, Function, IVm, Unpacked};

impl<A: IVm> TryFrom<Any<A>> for Function<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Function(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}
