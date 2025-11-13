use crate::vm::{Any, BigInt, IVm, Unpacked};

impl<A: IVm> TryFrom<Any<A>> for BigInt<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::BigInt(result) = value.into() else {
            return Err(());
        };
        Ok(result)
    }
}
