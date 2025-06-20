use crate::vm::internal::{IContainer, IInternalAny};

#[derive(Clone)]
pub struct BigInt<A: IInternalAny>(pub A::InternalBigInt);

impl<A: IInternalAny> PartialEq for BigInt<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.deep_eq(&other.0)
    }
}
