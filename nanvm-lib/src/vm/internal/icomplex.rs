use crate::vm::IVm;

/// A heap value: cloned by reference, compared by identity.
pub trait IComplex<A: IVm>: Sized + Clone {
    fn ptr_eq(&self, other: &Self) -> bool;
}
