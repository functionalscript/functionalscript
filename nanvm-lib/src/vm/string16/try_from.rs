use crate::vm::{Any, IVm, String16, Unpacked};

impl<A: IVm> TryFrom<Any<A>> for String16<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::String(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}
