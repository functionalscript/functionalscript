use crate::vm::{Function, IComplex, IVm};

impl<A: IVm> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}
