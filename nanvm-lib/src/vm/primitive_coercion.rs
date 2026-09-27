use crate::vm::{
    Any, Array, BigInt, Function, IVm, Number, Object, String, Unpacked, dispatch::Dispatch,
    nullish::Nullish, primitive::Primitive,
};

use std::result::Result;

const CANNOT_CONVERT_TO_PRIMITIVE_VALUE: &str = "TypeError: Cannot convert to primitive value";

/// JavaScript calls an object's own `toString` or `valueOf`, which is not
/// implemented yet (Stage 2 of `nanvm-lib/todo/to-primitive.md`): an own
/// `toString`, or an own `valueOf` that is a function, is refused.
pub const OWN_CONVERSION_METHOD: &str =
    "TypeError: Cannot convert an object with its own toString or valueOf";

/// A function converts to its text, which is not implemented yet (Stage 3
/// of `nanvm-lib/todo/to-primitive.md`). Only a result that does not depend
/// on the text is answered: see `NumberCoercion` and `is_less_than`.
pub const FUNCTION_TEXT: &str = "TypeError: Cannot convert a function to its text";

/// Preferred type for coercion to primitive, as per ECMAScript specification.
/// <https://tc39.es/ecma262/#sec-toprimitive>
/// Note that preferredType can be absent - we express that by using None value of
/// Option<ToPrimitivePreferredType>.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToPrimitivePreferredType {
    Number,
    String,
}

fn value_of<A: IVm, T>(_: T, /* Object<A> | Array<A> */) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-object.prototype.valueof
    // The stock method answers the object itself, which is not a primitive. An own "valueOf" is
    // refused before this (`OWN_CONVERSION_METHOD`).
    None
}

fn obj_to_string<A: IVm>(_o: Object<A>) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-object.prototype.tostring
    // The stock method. An own "toString" is refused before this (`OWN_CONVERSION_METHOD`).
    Some(Ok(Primitive::String("[object Object]".into())))
}

fn arr_to_string<A: IVm>(a: Array<A>) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-array.prototype.tostring
    // TODO: implement a call to user-defined "toString" method, and, while implementing the default
    // behavior, implement a call to user-defined "join" methods. Until then this is the built-in
    // `join` with its default separator, which is what `Array.prototype.toString` calls.
    Some(a.join(",".into()).map(Primitive::String))
}

fn obj_to_primitive<A: IVm>(
    o: Object<A>,
    preferred_type: ToPrimitivePreferredType,
) -> Result<Primitive<A>, Any<A>> {
    // Refused, not answered with the stock methods' result: an own
    // `toString` shadows the stock one, and one that is no function makes
    // JavaScript throw. An own `valueOf` shadows only when it is a function:
    // otherwise JavaScript skips it, as the stock order below already does.
    let own_value_of = o.own_property(&"valueOf".into());
    if o.own_property(&"toString".into()).is_some()
        || own_value_of.is_some_and(|v| matches!(Unpacked::from(v), Unpacked::Function(_)))
    {
        return Err(OWN_CONVERSION_METHOD.into());
    }
    match preferred_type {
        ToPrimitivePreferredType::Number => match value_of(o.clone()) {
            Some(res) => res,
            None => match obj_to_string(o) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
        ToPrimitivePreferredType::String => match obj_to_string(o.clone()) {
            Some(res) => res,
            None => match value_of(o) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
    }
}

fn arr_to_primitive<A: IVm>(
    a: Array<A>,
    preferred_type: ToPrimitivePreferredType,
) -> Result<Primitive<A>, Any<A>> {
    match preferred_type {
        ToPrimitivePreferredType::Number => match value_of(a.clone()) {
            Some(res) => res,
            None => match arr_to_string(a) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
        ToPrimitivePreferredType::String => match arr_to_string(a.clone()) {
            Some(res) => res,
            None => match value_of(a) {
                Some(res) => res,
                None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
            },
        },
    }
}

/// Coerces the value to a primitive type `Primitive<A>`, possibly producing an error result.
/// <https://tc39.es/ecma262/#sec-toprimitive>
#[allow(dead_code)]
pub struct PrimitiveCoercionOp(pub Option<ToPrimitivePreferredType>);

impl<A: IVm> Dispatch<A> for PrimitiveCoercionOp {
    type Result = std::result::Result<Primitive<A>, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        Ok(Primitive::Nullish(v))
    }

    fn bool(self, v: bool) -> Self::Result {
        Ok(Primitive::Boolean(v))
    }

    fn number(self, v: Number) -> Self::Result {
        Ok(Primitive::Number(v))
    }

    fn string(self, v: String<A>) -> Self::Result {
        Ok(Primitive::String(v))
    }

    fn bigint(self, v: BigInt<A>) -> Self::Result {
        Ok(Primitive::BigInt(v))
    }

    fn object(self, o: Object<A>) -> Self::Result {
        // https://tc39.es/ecma262/#sec-ordinarytoprimitive - point 2 defaults to number preference
        obj_to_primitive(o, self.0.unwrap_or(ToPrimitivePreferredType::Number))
    }

    fn array(self, a: Array<A>) -> Self::Result {
        // https://tc39.es/ecma262/#sec-ordinarytoprimitive - point 2 defaults to number preference
        arr_to_primitive(a, self.0.unwrap_or(ToPrimitivePreferredType::Number))
    }

    fn function(self, _: Function<A>) -> Self::Result {
        // https://tc39.es/ecma262/#sec-function.prototype.tostring: the
        // stock `valueOf` answers the function itself, so every hint ends at
        // the function's text.
        Err(FUNCTION_TEXT.into())
    }
}

/// One test per row of Stage 1 in `nanvm-lib/todo/to-primitive.md`: what is
/// refused throws, and what does not depend on a function's text keeps its
/// value.
#[cfg(test)]
mod tests {
    use super::{FUNCTION_TEXT, OWN_CONVERSION_METHOD};
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, IStaticFunction, Number, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    fn s(v: &str) -> Any<A> {
        v.into()
    }

    fn function() -> Any<A> {
        A::static_function(|_, _| Ok(1.0.to_any()), 0, [].to_array()).to_any()
    }

    fn with_own(key: &str, value: Any<A>) -> Any<A> {
        [(key.into(), value)].to_object().to_any()
    }

    fn refused<T: core::fmt::Debug + PartialEq>(r: Result<T, Any<A>>, message: &str) {
        assert_eq!(r, Err(message.into()));
    }

    fn is_nan(r: Result<Number, Any<A>>) -> bool {
        r.unwrap().is_nan()
    }

    /// An own `toString`, whatever it holds, and an own `valueOf` that is a
    /// function, for every hint and every caller.
    #[test]
    fn object_with_an_own_method_is_refused() {
        let owns = [
            ("toString", function()),
            ("toString", s("h")),
            ("toString", 1.0.to_any()),
            ("valueOf", function()),
        ];
        for (key, value) in owns {
            let o = || with_own(key, value.clone());
            refused(o().to_string(), OWN_CONVERSION_METHOD);
            refused(o().to_number(), OWN_CONVERSION_METHOD);
            refused(o().to_numeric().map(|_| ()), OWN_CONVERSION_METHOD);
            refused(o() + 1.0.to_any(), OWN_CONVERSION_METHOD);
            refused(s("a") + o(), OWN_CONVERSION_METHOD);
            refused(o().lt(1.0.to_any()), OWN_CONVERSION_METHOD);
            refused(1.0.to_any().lt(o()), OWN_CONVERSION_METHOD);
        }
    }

    /// An own `valueOf` that is no function is skipped, by JavaScript and by
    /// the stock order alike, so it converts as a plain object does:
    /// `String({ valueOf: "x" })` is `"[object Object]"` and
    /// `+{ valueOf: "x" }` is `NaN`.
    #[test]
    fn own_value_of_that_is_no_function_is_skipped() {
        for value in [s("x"), 1.0.to_any()] {
            let o = || with_own("valueOf", value.clone());
            assert_eq!(o().to_string(), Ok("[object Object]".into()));
            assert!(is_nan(o().to_number()));
            assert_eq!(o() + s("!"), Ok(s("[object Object]!")));
        }
    }

    /// Any other own property keeps the stock conversion.
    #[test]
    fn plain_object_is_unchanged() {
        let o = || with_own("a", function());
        assert_eq!(o().to_string(), Ok("[object Object]".into()));
        assert!(is_nan(o().to_number()));
        assert_eq!((o() + s("!")), Ok(s("[object Object]!")));
    }

    /// `String(f)` and `f + x` observe the text.
    #[test]
    fn function_text_is_refused() {
        refused(function().to_string(), FUNCTION_TEXT);
        refused(function() + s("!"), FUNCTION_TEXT);
        refused(function() + 1.0.to_any(), FUNCTION_TEXT);
        refused(1.0.to_any() + function(), FUNCTION_TEXT);
        refused(function() + function(), FUNCTION_TEXT);
    }

    /// `+f`, `-f`, `f - 1` and `f ^ 6`: `NaN` for every text, so
    /// unchanged.
    #[test]
    fn function_number_is_nan() {
        assert!(is_nan(function().to_number()));
        assert_eq!((-function()).map(Any::is_nan), Ok(true));
        assert_eq!((function() - 1.0.to_any()).map(Any::is_nan), Ok(true));
        assert_eq!(function() ^ 6.0.to_any(), Ok(6.0.to_any()));
    }

    /// `f < "z"` compares the text; `f < 5` and `f < 5n` are `false` for
    /// every text.
    #[test]
    fn function_comparison() {
        refused(function().lt(s("z")), FUNCTION_TEXT);
        refused(s("z").lt(function()), FUNCTION_TEXT);
        refused(function().lt(function()), FUNCTION_TEXT);
        refused(function().ge(s("z")), FUNCTION_TEXT);
        let five = || 5.0.to_any();
        let big = || BigInt::<A>::from(5i64).to_any();
        // An array's primitive is a string too.
        refused(function().lt([].to_array().to_any()), FUNCTION_TEXT);
        for other in [five(), big(), true.to_any()] {
            assert_eq!(function().lt(other.clone()), Ok(false.to_any()));
            assert_eq!(other.clone().lt(function()), Ok(false.to_any()));
            assert_eq!(function().le(other.clone()), Ok(false.to_any()));
            assert_eq!(function().ge(other), Ok(false.to_any()));
        }
    }
}
