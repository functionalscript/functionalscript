use crate::vm::{IContainer, IVm, String16};

impl<A: IVm> PartialEq for String16<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.items_eq(&other.0)
    }
}
