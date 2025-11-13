use crate::vm::{Any, IVm, Object, Unpacked};

impl<A: IVm> TryFrom<Any<A>> for Object<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Object(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}
