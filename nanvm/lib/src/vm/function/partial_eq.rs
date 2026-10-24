use crate::vm::{Function, IComplex, IVm};

/// Identity: a function is its own value, by reference.
impl<A: IVm> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.internal().ptr_eq(other.internal())
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Function, IVm, ToArray},
    };

    type A = Naive;

    fn closure() -> Function<A> {
        A::static_function(|_, _| Ok(Any::undefined()), 0, [].to_array(), None)
    }

    /// Two closures from one code are two functions, and a clone is the
    /// same one: `(() => 1) === (() => 1)` is `false`.
    #[test]
    fn closures_by_reference() {
        let f = closure();
        assert_ne!(f, closure());
        assert_eq!(f.clone(), f);
    }
}
