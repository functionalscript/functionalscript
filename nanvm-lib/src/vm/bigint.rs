use crate::vm::{Any, IContainer, IInternalAny, Unpacked};
use std::fmt::{Debug, Formatter};

#[derive(Clone)]
pub struct BigInt<A: IInternalAny>(pub A::InternalBigInt);

impl<A: IInternalAny> PartialEq for BigInt<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.deep_eq(&other.0)
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for BigInt<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::BigInt(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> Debug for BigInt<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        // TODO: bigint output with `n` suffix.
        write!(f, "0n")
    }
}
