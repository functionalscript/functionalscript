use crate::vm::{
    Any, Array, BigInt, Function, IVm, Number, Object, String, Unpacked, dispatch::Dispatch,
    join::Join, nullish::Nullish, primitive::Primitive,
};

use std::result::Result;

const CANNOT_CONVERT_TO_PRIMITIVE_VALUE: &str = "TypeError: Cannot convert to primitive value";

/// A function converts to its text, which is not implemented yet (Stage 3
/// of `nanvm-lib/todo/to-primitive.md`). Only a result that does not depend
/// on the text is answered: see `NumberCoercion` and `is_less_than`.
pub const FUNCTION_TEXT: &str = "TypeError: Cannot convert a function to its text";

fn arr_element_to_string<A: IVm>(v: Any<A>) -> Result<String<A>, Any<A>> {
    // https://tc39.es/ecma262/#sec-array.prototype.join: in case the element is nullish, on
    // joining it is represented as an empty string (see point 7.c: If element is neither undefined
    // nor null, then...)
    Nullish::try_from(v.clone())
        .map(|_| Ok("".into()))
        .unwrap_or_else(|_| v.to_string())
}

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

fn value_of<A: IVm>(_: Array<A>) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-object.prototype.valueof
    // The stock method answers the array itself, which is not a primitive.
    None
}

fn arr_to_string<A: IVm>(a: Array<A>) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-array.prototype.tostring
    // https://tc39.es/ecma262/#sec-array.prototype.join
    // The stock method: an array owns only its elements and `length`, never a "toString" or a
    // "join", so it joins the elements, coerced to strings, with the default "," separator.
    let s = a
        .into_iter()
        .map(|v| arr_element_to_string(v))
        .join(",".into());
    Some(s.map(Primitive::String))
}

/// A method `OrdinaryToPrimitive` tries: its name, and what the stock
/// method answers when the object does not own one — `None` for
/// <https://tc39.es/ecma262/#sec-object.prototype.valueof>, which answers
/// the object itself, not a primitive, and `"[object Object]"` for
/// <https://tc39.es/ecma262/#sec-object.prototype.tostring>.
type ConversionMethod = (&'static str, Option<&'static str>);

const VALUE_OF: ConversionMethod = ("valueOf", None);

const TO_STRING: ConversionMethod = ("toString", Some("[object Object]"));

/// <https://tc39.es/ecma262/#sec-ordinarytoprimitive>: the hint picks the
/// order of the two methods, and the first to answer a primitive is the
/// result.
fn obj_to_primitive<A: IVm>(
    o: Object<A>,
    preferred_type: ToPrimitivePreferredType,
) -> Result<Primitive<A>, Any<A>> {
    let order = match preferred_type {
        ToPrimitivePreferredType::Number => [VALUE_OF, TO_STRING],
        ToPrimitivePreferredType::String => [TO_STRING, VALUE_OF],
    };
    for method in order {
        if let Some(p) = obj_method(&o, method)? {
            return Ok(p);
        }
    }
    Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into())
}

/// One method of `OrdinaryToPrimitive`: its primitive result, or `None` to
/// move on to the next method.
///
/// An own property shadows the stock method, as it does for an explicit
/// call (`Member`). One that is no function is skipped. A function is
/// called with no arguments and without a receiver, as `Member`'s call is:
/// no FunctionalScript function reads `this`. Its throw propagates, and a
/// result that is not a primitive moves on, unconverted, so the conversion
/// never recurses through a result.
fn obj_method<A: IVm>(
    o: &Object<A>,
    (name, stock): ConversionMethod,
) -> Result<Option<Primitive<A>>, Any<A>> {
    match o.own_property(&name.into()) {
        Some(m) => match Function::try_from(m) {
            Ok(f) => f.call(Array::default()).map(to_primitive_value),
            Err(_) => Ok(None),
        },
        None => Ok(stock.map(|s| Primitive::String(s.into()))),
    }
}

/// The value as a primitive, or `None` for an object, an array or a function.
fn to_primitive_value<A: IVm>(v: Any<A>) -> Option<Primitive<A>> {
    match v.into() {
        Unpacked::Nullish(n) => Some(Primitive::Nullish(n)),
        Unpacked::Boolean(b) => Some(Primitive::Boolean(b)),
        Unpacked::Number(n) => Some(Primitive::Number(n)),
        Unpacked::String(s) => Some(Primitive::String(s)),
        Unpacked::BigInt(i) => Some(Primitive::BigInt(i)),
        Unpacked::Object(_) | Unpacked::Array(_) | Unpacked::Function(_) => None,
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

/// Stage 1 of `nanvm-lib/todo/to-primitive.md`, one test per row: a
/// function's text is refused, and what does not depend on it keeps its
/// value. Stage 2, `OrdinaryToPrimitive` calling an object's own methods,
/// step by step.
#[cfg(test)]
mod tests {
    use super::{CANNOT_CONVERT_TO_PRIMITIVE_VALUE, FUNCTION_TEXT};
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

    /// `() => v`, answering its frame's one item.
    fn returns(v: Any<A>) -> Any<A> {
        A::static_function(|self_, _| Ok(A::frame(self_)[0].clone()), 0, [v].to_array()).to_any()
    }

    /// `() => { throw v }`, throwing its frame's one item.
    fn throws(v: &str) -> Any<A> {
        A::static_function(
            |self_, _| Err(A::frame(self_)[0].clone()),
            0,
            [s(v)].to_array(),
        )
        .to_any()
    }

    fn with(props: &[(&str, Any<A>)]) -> Any<A> {
        props
            .iter()
            .map(|(k, v)| ((*k).into(), v.clone()))
            .collect::<Vec<_>>()
            .to_object()
            .to_any()
    }

    fn refused<T: core::fmt::Debug + PartialEq>(r: Result<T, Any<A>>, message: &str) {
        assert_eq!(r, Err(message.into()));
    }

    fn is_nan(r: Result<Number, Any<A>>) -> bool {
        r.unwrap().is_nan()
    }

    /// An own method shadows the stock one, for every caller.
    #[test]
    fn own_method_is_called() {
        let o = || with(&[("toString", returns(s("b")))]);
        assert_eq!(o().to_string(), Ok("b".into()));
        assert_eq!(s("a") + o(), Ok(s("ab")));
        let o = || with(&[("valueOf", returns(1.0.to_any()))]);
        assert_eq!(o().to_number(), Ok(Number::from(1.0)));
        assert_eq!(o() + 1.0.to_any(), Ok(2.0.to_any()));
        assert_eq!(o().lt(2.0.to_any()), Ok(true.to_any()));
        let big = with(&[("valueOf", returns(BigInt::<A>::from(5i64).to_any()))]);
        assert_eq!(-big, Ok(BigInt::<A>::from(-5i64).to_any()));
    }

    /// `valueOf` first for the `number` hint and for none, `toString` first
    /// for `string`.
    #[test]
    fn hint_picks_the_order() {
        let o = || {
            with(&[
                ("valueOf", returns(1.0.to_any())),
                ("toString", returns(s("t"))),
            ])
        };
        assert_eq!(o().to_string(), Ok("t".into()));
        assert_eq!(o().to_number(), Ok(Number::from(1.0)));
        assert_eq!(o() + s("!"), Ok(s("1!")));
    }

    /// A method that is no function is skipped: the stock `toString`
    /// answers after a skipped `valueOf`, and the stock `valueOf` answers
    /// no primitive after a skipped `toString`.
    #[test]
    fn non_function_is_skipped() {
        for value in [s("x"), 1.0.to_any()] {
            let o = || with(&[("valueOf", value.clone())]);
            assert_eq!(o().to_string(), Ok("[object Object]".into()));
            assert!(is_nan(o().to_number()));
            let o = || with(&[("toString", value.clone())]);
            refused(o().to_string(), CANNOT_CONVERT_TO_PRIMITIVE_VALUE);
            refused(o().to_number(), CANNOT_CONVERT_TO_PRIMITIVE_VALUE);
        }
    }

    /// A method's throw is the conversion's, unchanged, and ends it.
    #[test]
    fn throw_propagates() {
        let o = || with(&[("valueOf", throws("boom")), ("toString", returns(s("t")))]);
        refused(o().to_number(), "boom");
        assert_eq!(o().to_string(), Ok("t".into()));
    }

    /// A binary operator converts its left operand first, so with both
    /// throwing, the left one's throw is the result. `>` and `<=` ask `<`
    /// of the swapped operands and still convert the left one first.
    #[test]
    fn left_operand_first() {
        type Op = fn(Any<A>, Any<A>) -> Result<Any<A>, Any<A>>;
        let ops: [Op; 16] = [
            |x, y| x + y,
            |x, y| x - y,
            |x, y| x * y,
            |x, y| x / y,
            |x, y| x % y,
            |x, y| x.pow(y),
            |x, y| x & y,
            |x, y| x | y,
            |x, y| x ^ y,
            |x, y| x << y,
            |x, y| x >> y,
            |x, y| x.unsigned_right_shift(y),
            Any::lt,
            Any::gt,
            Any::le,
            Any::ge,
        ];
        let o = |v| with(&[("valueOf", throws(v))]);
        for op in ops {
            refused(op(o("left"), o("right")), "left");
        }
    }

    /// A result that is not a primitive moves on, unconverted, and if
    /// neither method answers one the conversion throws.
    #[test]
    fn non_primitive_result_moves_on() {
        let inner = || with(&[("toString", returns(s("inner")))]);
        let o = || with(&[("valueOf", returns(inner()))]);
        assert!(is_nan(o().to_number()));
        for result in [inner(), [].to_array().to_any(), function()] {
            let o = || {
                with(&[
                    ("valueOf", returns(result.clone())),
                    ("toString", returns(s("2"))),
                ])
            };
            assert_eq!(o().to_number(), Ok(Number::from(2.0)));
            let o = || with(&[("toString", returns(result.clone()))]);
            refused(o().to_string(), CANNOT_CONVERT_TO_PRIMITIVE_VALUE);
        }
    }

    /// Any other own property keeps the stock conversion.
    #[test]
    fn plain_object_is_unchanged() {
        let o = || with(&[("a", function())]);
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
