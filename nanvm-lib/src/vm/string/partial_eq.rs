use crate::vm::{IContainer, IVm, String};

impl<A: IVm> PartialEq for String<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.items_eq(&other.0)
    }
}
