use crate::vm::{Any, Array, Function, IVm};

impl<A: IVm> Any<A> {
    /// The EDAG's `()` (`['()', callee, args]`): `callee(...args)`, the
    /// second operand spread. Both operands are values, as every EDAG
    /// operand is: the callee a function and the arguments an array, and
    /// either being anything else throws — the `TypeError` JavaScript throws
    /// for calling what is not a function, or for spreading what is not
    /// iterable — through the conversions `TryFrom<Any<A>>` already makes.
    /// The result, answered or thrown, is the function's own
    /// ([`IFunction::call`](crate::vm::IFunction::call)).
    pub fn call(self, args: Any<A>) -> Result<Any<A>, Any<A>> {
        Function::try_from(self)?.call(Array::try_from(args)?)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Function, IStaticFunction, Nullish, ToAny, ToArray, unstable::f64_any},
    };

    type A = Naive;

    /// A function that answers its arguments, as the array it was given.
    fn identity() -> Any<A> {
        A::static_function(|_, args| Ok(args.to_any()), 0, [].to_array()).to_any()
    }

    #[test]
    fn calls_with_the_arguments() {
        let args: Any<A> = [f64_any(0x3ff0000000000000), f64_any(0x4000000000000000)]
            .to_array()
            .to_any();
        assert_eq!(identity().call(args.clone()), Ok(args));
    }

    /// The code receives the function value it is the code of: answered as
    /// a value, it is the very function that was called.
    #[test]
    fn code_receives_itself() {
        let f: Any<A> = A::static_function(
            |self_, _| Ok(Function::new(self_.clone()).to_any()),
            0,
            [].to_array(),
        )
        .to_any();
        assert_eq!(f.clone().call([].to_array().to_any()), Ok(f));
    }

    #[test]
    fn a_non_function_callee_throws() {
        let callee: Any<A> = f64_any(0x3ff0000000000000);
        assert_eq!(
            callee.call([].to_array().to_any()),
            Err("Type Error".into())
        );
    }

    #[test]
    fn non_array_arguments_throw() {
        assert_eq!(
            identity().call(Nullish::Null.to_any()),
            Err("Type Error".into())
        );
    }
}
