use crate::vm::{
    Any, IVm,
    lambda::{OptionLambda, Region, call},
};

impl<A: IVm> Any<A> {
    /// The EDAG's `?.()` node, `['?.()', callee, args, k]`: `a?.(...args)`,
    /// opening a short-circuit region. A nullish callee skips the arguments
    /// and the rest of the chain, which is why they are a thunk; any other
    /// callee has them evaluated first and is then called as `Any::call`
    /// calls it — `1?.(...args)` is the `TypeError` `1(...args)` is, after
    /// the arguments.
    pub fn option_call(self, args: impl FnOnce() -> Result<Self, Self>) -> OptionLambda<A> {
        OptionLambda(Region::Live(self).guarded(call(args)))
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, IStaticFunction, Nullish, ToAny, ToArray},
    };

    type A = Naive;

    fn args() -> Result<Any<A>, Any<A>> {
        Ok([7.0.to_any()].to_array().to_any())
    }

    #[test]
    fn calls_a_function() {
        let identity: Any<A> =
            A::static_function(|_, args| Ok(args.to_any()), 0, [].to_array()).to_any();
        let a = args().unwrap();
        assert_eq!(identity.option_call(|| Ok(a.clone())).end(), Ok(a));
    }

    /// A nullish callee skips the arguments and answers `undefined`.
    #[test]
    fn nullish_callee_skips() {
        assert_eq!(
            Nullish::Null
                .to_any::<A>()
                .option_call(|| Err("boom".into()))
                .end(),
            Ok(Nullish::Undefined.to_any())
        );
    }

    /// The guard is against a nullish callee, not a non-callable one: `1`
    /// passes it, the arguments run, and then the call throws.
    #[test]
    fn non_callable_callee_throws_after_the_arguments() {
        assert_eq!(
            1.0.to_any::<A>().option_call(|| Err("boom".into())).end(),
            Err("boom".into())
        );
        assert_eq!(
            1.0.to_any::<A>().option_call(args).end(),
            Err("Type Error".into())
        );
    }
}
