use crate::vm::{Function, IComplex, IVm};

/// Identity: a closure's own, by reference, and a built-in's, by name;
/// a closure and a built-in are never one function.
impl<A: IVm> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Function::Closure(a), Function::Closure(b)) => a.ptr_eq(b),
            (Function::Runtime(a), Function::Runtime(b)) => a.name == b.name,
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Array, Function, IStaticFunction, RuntimeFunction, ToAny, ToArray},
    };

    type A = Naive;

    fn undefined(_: Array<A>) -> Result<Any<A>, Any<A>> {
        Ok(Any::undefined())
    }

    /// A built-in by name, as the generated accessors answer one: a new
    /// handle on every read.
    fn built_in(name: &'static str) -> Function<A> {
        Function::Runtime(match name {
            "a" => &RuntimeFunction {
                name: "a",
                code: undefined,
                length: 0,
                text: "a",
            },
            _ => &RuntimeFunction {
                name: "b",
                code: undefined,
                length: 0,
                text: "b",
            },
        })
    }

    fn closure() -> Function<A> {
        A::static_function(|_, _| Ok(Any::undefined()), 0, [].to_array(), None)
    }

    /// Two reads of one built-in are equal, and `same_value`, as
    /// `Object.entries === Object.entries` is; two built-ins of two names
    /// are not.
    #[test]
    fn built_ins_by_name() {
        assert_eq!(built_in("a"), built_in("a"));
        assert!(built_in("a").to_any().same_value(&built_in("a").to_any()));
        assert_ne!(built_in("a"), built_in("b"));
    }

    /// Two closures from one code are two functions, and a clone is the
    /// same one: `(() => 1) === (() => 1)` is `false`.
    #[test]
    fn closures_by_reference() {
        let f = closure();
        assert_ne!(f, closure());
        assert_eq!(f.clone(), f);
    }

    /// A closure is never a built-in.
    #[test]
    fn kinds_differ() {
        assert_ne!(closure(), built_in("a"));
        assert_ne!(built_in("a"), closure());
    }
}
