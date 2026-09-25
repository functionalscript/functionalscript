use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Array, IVm, Nullish, ToAny, Unpacked},
};

/// A built-in member function: the receiver and the arguments, already the
/// `Array` a call spreads — `Member::call` converts them before any
/// built-in runs, throwing for a non-array as `Any::call` does — answering
/// the value or the throw.
pub(crate) type Method<A> = fn(Any<A>, Array<A>) -> Result<Any<A>, Any<A>>;

/// The built-in member function a key names on the receiver's type, for
/// the receiver a call step has found no own property on. The names a
/// module may call are `allowedCalls` in `fjs/js/prototype`, and which of
/// them this table answers, type by type, is
/// `nanvm-lib/todo/member-functions.md`; a name the table lacks is `None`,
/// and the call throws as JavaScript throws on a type without the method.
///
/// `toString` needs no receiver type: every type has it. Every other name
/// is the receiver type's own table, one function per type below.
pub(crate) fn method<A: IVm>(receiver: &Any<A>, key: &Any<A>) -> Option<Method<A>> {
    if *key == "toString".into() {
        return Some(to_string);
    }
    match Unpacked::from(receiver.clone()) {
        Unpacked::Array(_) => array(key),
        _ => None,
    }
}

/// `Array.prototype`'s.
fn array<A: IVm>(key: &Any<A>) -> Option<Method<A>> {
    if *key == "at".into() {
        return Some(array_at);
    }
    None
}

/// The `i`-th argument, or `undefined` past the end, as a built-in reads
/// a parameter the call left out.
fn argument<A: IVm>(args: &Array<A>, i: u32) -> Any<A> {
    if i < args.length() {
        args[i].clone()
    } else {
        Nullish::Undefined.to_any()
    }
}

/// `toString()`: a dispatch to `Any::to_string`, the `String(x)` conversion,
/// which answers what the method answers for a number, a boolean, a
/// bigint, a string, an object and an array. Two things it does not do yet,
/// both tracked in `member-functions.md`: a function answers the placeholder
/// the conversion answers, not its source, and a radix is not applied.
///
/// So a number or a bigint given a radix other than the default — absent,
/// `undefined` or `10` — throws rather than answers in radix ten:
/// `(255).toString(16)` is `"ff"` in JavaScript, and `"255"` would be a
/// different successful value (DESIGN.md §10). Every other type's
/// `toString` ignores its arguments, as JavaScript's does.
fn to_string<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    if matches!(
        Unpacked::from(receiver.clone()),
        Unpacked::Number(_) | Unpacked::BigInt(_)
    ) {
        let default_radix = match Unpacked::from(argument(&args, 0)) {
            Unpacked::Nullish(Nullish::Undefined) => true,
            Unpacked::Number(radix) => f64::from(radix) == 10.0,
            _ => false,
        };
        if !default_radix {
            return Err("RangeError: a toString radix other than 10 is not supported yet".into());
        }
    }
    receiver.to_string().map(|s| s.to_any())
}

/// `Array.prototype.at`, `vm/array/at.rs`. The receiver is the array
/// [`method`] matched, so the conversion cannot throw.
fn array_at<A: IVm>(receiver: Any<A>, args: Array<A>) -> Result<Any<A>, Any<A>> {
    Array::try_from(receiver)?.at(argument(&args, 0))
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, IStaticFunction, Nullish, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    fn to_string_with(receiver: Any<A>, radix: Any<A>) -> Result<Any<A>, Any<A>> {
        receiver
            .dot("toString".into())
            .end_call(|| Ok([radix].to_array().to_any()))
    }

    /// A radix on a number or a bigint: the default reads as radix ten, any
    /// other throws until radixes land, rather than answer in radix ten
    /// (`member-functions.md`). Other types ignore the argument.
    #[test]
    fn to_string_radix() {
        let refused = Err("RangeError: a toString radix other than 10 is not supported yet".into());
        let n = || 255.0.to_any();
        let b = || BigInt::<A>::from(255i64).to_any();
        assert_eq!(to_string_with(n(), 10.0.to_any()), Ok("255".into()));
        assert_eq!(
            to_string_with(n(), Nullish::Undefined.to_any()),
            Ok("255".into())
        );
        assert_eq!(to_string_with(n(), 16.0.to_any()), refused);
        assert_eq!(to_string_with(n(), 2.0.to_any()), refused);
        assert_eq!(to_string_with(b(), 10.0.to_any()), Ok("255".into()));
        assert_eq!(to_string_with(b(), 16.0.to_any()), refused);
        assert_eq!(to_string(b()), Ok("255".into()));
        assert_eq!(
            to_string_with([1.0.to_any()].to_array().to_any(), 16.0.to_any()),
            Ok("1".into())
        );
        assert_eq!(
            to_string_with(true.to_any(), 16.0.to_any()),
            Ok("true".into())
        );
    }

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

    /// `at` on an array, through a call: the index converted, the end
    /// counted from, out of range `undefined`, and a missing argument
    /// element `0`.
    #[test]
    fn array_at() {
        let arr: Any<A> = [1.0.to_any(), 2.0.to_any(), 3.0.to_any()]
            .to_array()
            .to_any();
        let at = |index: Any<A>| {
            arr.clone()
                .dot("at".into())
                .end_call(|| Ok([index].to_array().to_any()))
        };
        assert_eq!(at(0.0.to_any()), Ok(1.0.to_any()));
        assert_eq!(at((-1.0f64).to_any()), Ok(3.0.to_any()));
        assert_eq!(at("1".into()), Ok(2.0.to_any()));
        assert_eq!(at(3.0.to_any()), Ok(Nullish::Undefined.to_any()));
        assert_eq!(arr.dot("at".into()).end_call(no_args), Ok(1.0.to_any()));
    }

    /// A name is a method of its receiver's type alone: `at` is an
    /// array's, not an object's or a number's, and a key that is no name
    /// is nobody's.
    #[test]
    fn unknown_name_is_none() {
        let arr: Any<A> = [].to_array().to_any();
        let object: Any<A> = [].to_object().to_any();
        assert!(super::method::<A>(&arr, &"at".into()).is_some());
        assert!(super::method::<A>(&object, &"at".into()).is_none());
        assert!(super::method::<A>(&1.0.to_any(), &"at".into()).is_none());
        assert!(super::method::<A>(&arr, &"map".into()).is_none());
        assert!(super::method::<A>(&arr, &0.0.to_any()).is_none());
    }
}
