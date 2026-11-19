use crate::vm::IVm;

/// A heap value: cloned by reference, compared by identity.
pub trait IComplex<A: IVm>: Sized + Clone {
    fn ptr_eq(&self, other: &Self) -> bool;
    /// A number for the identity [`ptr_eq`](Self::ptr_eq) compares: equal
    /// for two values that are one, and different for two that are not, as
    /// long as both are alive. A value freed may leave its number to
    /// another, so whoever keeps a number keeps the value with it. It is
    /// what lets a reference be found in fewer steps than a comparison with
    /// every other, and it never reaches a program.
    fn address(&self) -> usize;
}
