use crate::vm::{IComplex, IVm, Object};

impl<A: IVm> PartialEq for Object<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IVm> Object<A> {
    /// The number of this value's identity, [`IComplex::address`].
    pub(crate) fn address(&self) -> usize {
        self.0.address()
    }
}
