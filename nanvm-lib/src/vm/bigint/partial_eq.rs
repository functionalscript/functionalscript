use crate::vm::{BigInt, IContainer, IVm};

impl<A: IVm> PartialEq for BigInt<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.items_eq(&other.0)
    }
}
