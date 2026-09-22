use crate::vm::{Any, IVm, ToAny};

/// A built-in member function: the receiver and the arguments array, as an
/// `Any`, answering the value or the throw.
pub(crate) type Method<A> = fn(Any<A>, Any<A>) -> Result<Any<A>, Any<A>>;

/// The built-in member function a key names, for the receiver a call step
/// has found no own property on. The names a module may call are
/// `allowedCalls` in `fjs/js/prototype`, and which of them this table
/// answers, type by type, is `nanvm-lib/todo/member-functions.md`; a name
/// the table lacks is `None`, and the call throws as JavaScript throws on a
/// type without the method.
///
/// `toString` is the one entry, and it needs no receiver type: every type
/// has it. The entries to come match on the receiver's type as well.
pub(crate) fn method<A: IVm>(key: &Any<A>) -> Option<Method<A>> {
    if *key == "toString".into() {
        return Some(to_string);
    }
    None
}

/// `toString()`: a dispatch to `Any::to_string`, the `String(x)` conversion,
/// which answers what the method answers for a number, a boolean, a
/// bigint, a string, an object and an array. Two things it does not do yet,
/// both tracked in `member-functions.md`: a function answers the placeholder
/// the conversion answers, not its source, and the arguments are not read,
/// so a radix is not applied.
fn to_string<A: IVm>(receiver: Any<A>, _args: Any<A>) -> Result<Any<A>, Any<A>> {
    receiver.to_string().map(|s| s.to_any())
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, IStaticFunction, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    fn no_args() -> Result<Any<A>, Any<A>> {
        Ok([].to_array().to_any())
    }
    fn to_string(receiver: Any<A>) -> Result<Any<A>, Any<A>> {
        receiver.dot("toString".into()).end_call(no_args)
    }

    /// `toString()` on every type answers what `String(x)` answers.
    #[test]
    fn to_string_on_every_type() {
        assert_eq!(to_string(1.5.to_any()), Ok("1.5".into()));
        assert_eq!(to_string(true.to_any()), Ok("true".into()));
        assert_eq!(to_string("ab".into()), Ok("ab".into()));
        assert_eq!(
            to_string([].to_object().to_any()),
            Ok("[object Object]".into())
        );
        assert_eq!(
            to_string([1.0.to_any(), "b".into()].to_array().to_any()),
            Ok("1,b".into())
        );
        let f: Any<A> = A::static_function(|_, _| Ok(1.0.to_any()), 0, [].to_array()).to_any();
        // the conversion's placeholder, not the source text —
        // `member-functions.md`
        assert_eq!(to_string(f), Ok("function".into()));
    }

    /// Through a region as well: `a?.toString()`, `(a?.toString)()`, and
    /// `a?.b.toString()` reading then calling.
    #[test]
    fn to_string_in_a_region() {
        let arr: Any<A> = [1.0.to_any(), 2.0.to_any()].to_array().to_any();
        assert_eq!(
            arr.clone()
                .option_dot(|| Ok("toString".into()))
                .call(no_args)
                .end(),
            Ok("1,2".into())
        );
        assert_eq!(
            arr.clone()
                .option_dot(|| Ok("toString".into()))
                .end_call(no_args),
            Ok("1,2".into())
        );
        let o: Any<A> = [("b".into(), arr)].to_object().to_any();
        assert_eq!(
            o.option_dot(|| Ok("b".into()))
                .dot(|| Ok("toString".into()))
                .call(no_args)
                .end(),
            Ok("1,2".into())
        );
    }

    /// Any other name is no method.
    #[test]
    fn unknown_name_is_none() {
        assert!(super::method::<A>(&"at".into()).is_none());
        assert!(super::method::<A>(&0.0.to_any()).is_none());
    }
}
