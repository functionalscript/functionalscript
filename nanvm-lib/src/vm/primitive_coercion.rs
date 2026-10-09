use crate::vm::{
    Any, Array, BigInt, Function, IVm, Number, Object, String, Unpacked, dispatch::Dispatch,
    nullish::Nullish, primitive::Primitive,
};

use std::result::Result;

const CANNOT_CONVERT_TO_PRIMITIVE_VALUE: &str = "TypeError: Cannot convert to primitive value";

/// A function converts to its text, and one that has none — a host or
/// hand-written function, which no EDAG renders — is refused. A result that
/// does not depend on the text is answered without it: see
/// `NumberCoercion` and `is_less_than`.
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

fn value_of<A: IVm>(_: Array<A>) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-object.prototype.valueof
    // The stock method answers the array itself, which is not a primitive.
    None
}

fn arr_to_string<A: IVm>(a: Array<A>) -> Option<Result<Primitive<A>, Any<A>>> {
    // https://tc39.es/ecma262/#sec-array.prototype.tostring
    // https://tc39.es/ecma262/#sec-array.prototype.join
    // The stock method: an array owns only its elements and `length`, never a "toString" or a
    // "join", so this is the built-in `join` with its default separator.
    Some(a.join(",".into()).map(Primitive::String))
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

    fn function(self, f: Function<A>) -> Self::Result {
        // https://tc39.es/ecma262/#sec-function.prototype.tostring: the
        // stock `valueOf` answers the function itself, so every hint ends at
        // the function's text, and one without a text is refused.
        f.text()
            .map(|text| Primitive::String(text.into()))
            .ok_or_else(|| FUNCTION_TEXT.into())
    }
}

/// Stage 1 of `nanvm-lib/todo/to-primitive.md`, one test per row: a
/// function's text is refused where it has none, and what does not depend
/// on it keeps its value. Stage 2, `OrdinaryToPrimitive` calling an
/// object's own methods, step by step. Stage 3, a function's text.
#[cfg(test)]
mod tests {
    use super::ToPrimitivePreferredType;
    use super::{CANNOT_CONVERT_TO_PRIMITIVE_VALUE, FUNCTION_TEXT};
    use crate::common::sized_index::SizedIndex;
    use crate::{
        naive::Naive,
        vm::{
            Any, BigInt, IStaticFunction, Nullish, Number, ToAny, ToArray, ToObject,
            primitive::Primitive,
        },
    };

    type A = Naive;

    fn s(v: &str) -> Any<A> {
        v.into()
    }

    fn function() -> Any<A> {
        A::static_function(|_, _| Ok(1.0.to_any()), 0, [].to_array(), None).to_any()
    }

    /// `() => v`, answering its frame's one item.
    fn returns(v: Any<A>) -> Any<A> {
        A::static_function(
            |self_, _| Ok(A::frame(self_)[0].clone()),
            0,
            [v].to_array(),
            None,
        )
        .to_any()
    }

    /// `() => { throw v }`, throwing its frame's one item.
    fn throws(v: &str) -> Any<A> {
        A::static_function(
            |self_, _| Err(A::frame(self_)[0].clone()),
            0,
            [s(v)].to_array(),
            None,
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
            assert_eq!(o() + s("!"), Ok(s("[object Object]!")));
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

    /// The `string` hint tries `toString` first, and the stock one answers
    /// before a function `valueOf` is reached: `String({ valueOf: f })` is
    /// `"[object Object]"`, while `+{ valueOf: f }` calls `f`.
    #[test]
    fn string_hint_never_reaches_value_of() {
        let o = || with(&[("valueOf", function())]);
        assert_eq!(o().to_string(), Ok("[object Object]".into()));
        assert_eq!(o().to_number(), Ok(Number::from(1.0)));
    }

    /// Any other own property keeps the stock conversion.
    #[test]
    fn plain_object_is_unchanged() {
        let o = || with(&[("a", function())]);
        assert_eq!(o().to_string(), Ok("[object Object]".into()));
        assert!(is_nan(o().to_number()));
        assert_eq!((o() + s("!")), Ok(s("[object Object]!")));
    }

    /// `() => 1` with the text the compiler renders for it.
    fn texted() -> Any<A> {
        A::static_function(|_, _| Ok(1.0.to_any()), 0, [].to_array(), Some("()=>1")).to_any()
    }

    /// `String(f)`, `f + x`, `f < "z"` and an array holding `f` read the
    /// function's text.
    #[test]
    fn function_text() {
        assert_eq!(texted().to_string(), Ok("()=>1".into()));
        assert_eq!(texted() + s("!"), Ok(s("()=>1!")));
        assert_eq!(1.0.to_any() + texted(), Ok(s("1()=>1")));
        assert_eq!(texted() + texted(), Ok(s("()=>1()=>1")));
        assert_eq!(texted().lt(s("z")), Ok(true.to_any()));
        assert_eq!(s("(").lt(texted()), Ok(true.to_any()));
        assert_eq!(
            [texted(), 2.0.to_any()]
                .to_array()
                .to_any::<A>()
                .to_string(),
            Ok("()=>1,2".into())
        );
        assert!(is_nan([texted()].to_array().to_any().to_number()));
        // and `NaN` wherever the number does not depend on it
        assert!(is_nan(texted().to_number()));
    }

    /// `String(f)` and `f + x` observe the text, which a function without
    /// one does not have.
    #[test]
    fn function_without_text_is_refused() {
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

    /// `x`, an object whose every conversion method throws `"boom"`.
    fn boom() -> Any<A> {
        with(&[("valueOf", throws("boom")), ("toString", throws("boom"))])
    }

    /// Each member function that converts an argument reaches the
    /// conversion: with `x` throwing, the call throws `x`'s throw.
    #[test]
    fn member_arguments_are_converted() {
        let arr = || {
            [1.0.to_any(), 2.0.to_any(), 3.0.to_any()]
                .to_array()
                .to_any()
        };
        let str = || s("abc");
        let (zero, one) = (|| 0.0.to_any(), || 1.0.to_any());
        let x = boom;
        type Case = (&'static str, Any<A>, &'static str, Vec<Any<A>>);
        let cases: Vec<Case> = vec![
            ("array.at", arr(), "at", vec![x()]),
            ("array.slice start", arr(), "slice", vec![x()]),
            ("array.slice end", arr(), "slice", vec![zero(), x()]),
            ("array.indexOf from", arr(), "indexOf", vec![one(), x()]),
            (
                "array.lastIndexOf from",
                arr(),
                "lastIndexOf",
                vec![one(), x()],
            ),
            ("array.includes from", arr(), "includes", vec![one(), x()]),
            ("array.join", arr(), "join", vec![x()]),
            ("array.toSpliced start", arr(), "toSpliced", vec![x()]),
            (
                "array.toSpliced skip",
                arr(),
                "toSpliced",
                vec![zero(), x()],
            ),
            ("array.with index", arr(), "with", vec![x(), one()]),
            ("array.flat depth", arr(), "flat", vec![x()]),
            ("string.at", str(), "at", vec![x()]),
            ("string.charAt", str(), "charAt", vec![x()]),
            ("string.charCodeAt", str(), "charCodeAt", vec![x()]),
            ("string.codePointAt", str(), "codePointAt", vec![x()]),
            ("string.concat", str(), "concat", vec![x()]),
            ("string.endsWith needle", str(), "endsWith", vec![x()]),
            ("string.endsWith end", str(), "endsWith", vec![s("c"), x()]),
            ("string.startsWith needle", str(), "startsWith", vec![x()]),
            (
                "string.startsWith start",
                str(),
                "startsWith",
                vec![s("a"), x()],
            ),
            ("string.includes needle", str(), "includes", vec![x()]),
            ("string.includes pos", str(), "includes", vec![s("a"), x()]),
            ("string.indexOf needle", str(), "indexOf", vec![x()]),
            ("string.indexOf pos", str(), "indexOf", vec![s("a"), x()]),
            ("string.lastIndexOf needle", str(), "lastIndexOf", vec![x()]),
            (
                "string.lastIndexOf pos",
                str(),
                "lastIndexOf",
                vec![s("a"), x()],
            ),
            ("string.padEnd length", str(), "padEnd", vec![x()]),
            (
                "string.padEnd fill",
                str(),
                "padEnd",
                vec![5.0.to_any(), x()],
            ),
            ("string.padStart length", str(), "padStart", vec![x()]),
            (
                "string.padStart fill",
                str(),
                "padStart",
                vec![5.0.to_any(), x()],
            ),
            ("string.repeat", str(), "repeat", vec![x()]),
            (
                "string.replace pattern",
                str(),
                "replace",
                vec![x(), s("z")],
            ),
            (
                "string.replace replacement",
                str(),
                "replace",
                vec![s("a"), x()],
            ),
            (
                "string.replaceAll pattern",
                str(),
                "replaceAll",
                vec![x(), s("z")],
            ),
            (
                "string.replaceAll replacement",
                str(),
                "replaceAll",
                vec![s("a"), x()],
            ),
            ("string.slice start", str(), "slice", vec![x()]),
            ("string.slice end", str(), "slice", vec![zero(), x()]),
            ("string.substring start", str(), "substring", vec![x()]),
            (
                "string.substring end",
                str(),
                "substring",
                vec![zero(), x()],
            ),
            ("string.split separator", str(), "split", vec![x()]),
            ("string.split limit", str(), "split", vec![s("b"), x()]),
            ("number.toFixed", 1.5.to_any(), "toFixed", vec![x()]),
            (
                "number.toExponential",
                1.5.to_any(),
                "toExponential",
                vec![x()],
            ),
            ("number.toPrecision", 1.5.to_any(), "toPrecision", vec![x()]),
            ("number.toString radix", 1.5.to_any(), "toString", vec![x()]),
            (
                "bigint.toString radix",
                BigInt::<A>::from(5i64).to_any(),
                "toString",
                vec![x()],
            ),
        ];
        for (name, recv, method, args) in cases {
            assert_eq!(call(recv, method, args), Err("boom".into()), "{name}");
        }
    }

    fn big(n: i64) -> Any<A> {
        BigInt::<A>::from(n).to_any()
    }

    fn value_of(v: Any<A>) -> Any<A> {
        with(&[("valueOf", returns(v))])
    }

    fn to_string_of(v: Any<A>) -> Any<A> {
        with(&[("toString", returns(v))])
    }

    /// The members the call reads: `("slice", [1])` is `a.slice(1)`.
    fn call(recv: Any<A>, name: &str, args: Vec<Any<A>>) -> Result<Any<A>, Any<A>> {
        recv.dot(name.into())
            .end_call(|| Ok(args.to_array().to_any()))
    }

    /// `ToNumeric` keeps a `BigInt` answer of `valueOf`, so the operators
    /// answer a `BigInt` with a `BigInt` and refuse to mix it with a number.
    #[test]
    fn big_int_value_of_is_numeric() {
        type Op = fn(Any<A>, Any<A>) -> Result<Any<A>, Any<A>>;
        let ops: [(&str, Op, i64); 11] = [
            ("+", |x, y| x + y, 8),
            ("-", |x, y| x - y, 4),
            ("*", |x, y| x * y, 12),
            ("/", |x, y| x / y, 3),
            ("%", |x, y| x % y, 0),
            ("**", |x, y| x.pow(y), 36),
            ("&", |x, y| x & y, 2),
            ("|", |x, y| x | y, 6),
            ("^", |x, y| x ^ y, 4),
            ("<<", |x, y| x << y, 24),
            (">>", |x, y| x >> y, 1),
        ];
        for (name, op, expected) in ops {
            assert_eq!(op(value_of(big(6)), big(2)), Ok(big(expected)), "{name}");
            assert_eq!(op(big(6), value_of(big(2))), Ok(big(expected)), "{name}");
            assert!(op(value_of(big(6)), 2.0.to_any()).is_err(), "{name} mixes");
            assert!(op(2.0.to_any(), value_of(big(6))).is_err(), "{name} mixes");
        }
        assert!(value_of(big(6)).unsigned_right_shift(big(1)).is_err());
        assert_eq!(value_of(big(1)).bitwise_not(), Ok(big(-2)));
        assert_eq!(-value_of(big(5)), Ok(big(-5)));
        // `ToNumber` has no `BigInt`: unary `+` refuses it, `ToNumeric` keeps it.
        refused(
            value_of(big(1)).to_number(),
            "TypeError: Cannot convert a BigInt value to a number",
        );
        assert!(value_of(big(1)).unary_plus().is_err());
        // A `toString` answering a number string is a number, never a `BigInt`.
        assert!((big(1) * to_string_of(s("2"))).is_err());
        assert_eq!(to_string_of(s("2")) * 3.0.to_any(), Ok(6.0.to_any()));
        // `+` with a string concatenates the `BigInt`'s digits.
        assert_eq!(value_of(big(1)) + s("a"), Ok(s("1a")));
        assert_eq!(s("a") + value_of(big(-1)), Ok(s("a-1")));
    }

    /// `+` has no hint: an object with only a `toString` falls through the
    /// stock `valueOf`, and a primitive string on either side wins.
    #[test]
    fn plus_without_a_hint() {
        assert_eq!(to_string_of(s("x")) + 1.0.to_any(), Ok(s("x1")));
        assert_eq!(1.0.to_any() + to_string_of(s("x")), Ok(s("1x")));
        assert_eq!(to_string_of(s("2")) + 1.0.to_any(), Ok(s("21")));
        assert_eq!(value_of(s("a")) + 1.0.to_any(), Ok(s("a1")));
        assert_eq!(value_of(1.0.to_any()) + to_string_of(s("t")), Ok(s("1t")));
        assert_eq!(
            value_of(1.0.to_any()) + value_of(2.0.to_any()),
            Ok(3.0.to_any())
        );
        assert_eq!(value_of(true.to_any()) + 1.0.to_any(), Ok(2.0.to_any()));
        assert_eq!(
            value_of(Nullish::Null.to_any()) + 1.0.to_any(),
            Ok(1.0.to_any())
        );
        assert!(is_nan(
            (value_of(Any::undefined()) + 1.0.to_any()).and_then(Any::to_number)
        ));
        // Both operands convert before either answer is used.
        let t = |v| with(&[("toString", throws(v))]);
        refused(t("a") + t("b"), "a");
        refused(1.0.to_any() + t("b"), "b");
    }

    /// Every primitive an own method may answer, through `ToString` and
    /// `ToNumber`.
    #[test]
    fn every_primitive_result() {
        let cases: [(Any<A>, &str, Option<f64>); 7] = [
            (Nullish::Null.to_any(), "null", Some(0.0)),
            (Any::undefined(), "undefined", None),
            (true.to_any(), "true", Some(1.0)),
            (s("7"), "7", Some(7.0)),
            (s(""), "", Some(0.0)),
            (2.5.to_any(), "2.5", Some(2.5)),
            ((-0.0).to_any(), "0", Some(-0.0)),
        ];
        for (v, text, number) in cases {
            assert_eq!(to_string_of(v.clone()).to_string(), Ok(text.into()));
            assert_eq!(
                value_of(v.clone()).to_string(),
                Ok("[object Object]".into())
            );
            let n = value_of(v.clone()).to_number().unwrap();
            match number {
                Some(x) => assert_eq!(f64::from(n).to_bits(), x.to_bits(), "{text}"),
                None => assert!(n.is_nan()),
            }
            // The result is the primitive itself, whichever method answers it.
            let n = f64::from(to_string_of(v).to_number().unwrap());
            assert_eq!(n.to_bits(), number.unwrap_or(f64::NAN).to_bits(), "{text}");
        }
        assert_eq!(to_string_of(big(5)).to_string(), Ok("5".into()));
        assert_eq!(to_string_of(s("-3")).to_number(), Ok(Number::from(-3.0)));
        assert_eq!(-value_of(s("3")), Ok((-3.0).to_any()));
        assert!(is_nan(value_of(s("5n")).to_number()));
    }

    /// The caller picks the hint. With `valueOf` answering `5` and `toString`
    /// answering `"1"`, a `number` hint reads `5` and a `string` hint `"1"`.
    #[test]
    fn hint_per_caller() {
        let o = || {
            with(&[
                ("valueOf", returns(5.0.to_any())),
                ("toString", returns(s("1"))),
            ])
        };
        // `number`: `ToNumber`, `ToNumeric` and the relational operators.
        assert_eq!(o().to_number(), Ok(Number::from(5.0)));
        assert_eq!(o() - 0.0.to_any(), Ok(5.0.to_any()));
        assert_eq!(o().lt(2.0.to_any()), Ok(false.to_any()));
        assert_eq!(o().ge(2.0.to_any()), Ok(true.to_any()));
        assert_eq!(2.0.to_any().gt(o()), Ok(false.to_any()));
        assert_eq!(2.0.to_any().le(o()), Ok(true.to_any()));
        // none, which is `number` as well.
        assert_eq!(o() + 0.0.to_any(), Ok(5.0.to_any()));
        // `string`: `ToString`, so a string method's argument and a joined element.
        assert_eq!(o().to_string(), Ok("1".into()));
        assert_eq!(call(s("a1b"), "indexOf", vec![o()]), Ok(1.0.to_any()));
        assert_eq!(
            call([o(), o()].to_array().to_any(), "join", vec![]),
            Ok(s("1,1"))
        );
        assert_eq!(
            call([1.0.to_any()].to_array().to_any(), "join", vec![o()]),
            Ok(s("1"))
        );
        // The public entry point: no hint is `number`.
        let hint = |h| match o().to_primitive(h).unwrap() {
            Primitive::Number(n) => format!("n{}", f64::from(n)),
            Primitive::String(t) => format!("s{}", std::string::String::from(t)),
            _ => unreachable!(),
        };
        assert_eq!(hint(None), "n5");
        assert_eq!(hint(Some(ToPrimitivePreferredType::Number)), "n5");
        assert_eq!(hint(Some(ToPrimitivePreferredType::String)), "s1");
    }

    /// The relational operators with objects: both operands convert with the
    /// `number` hint, then strings compare as strings, `BigInt` against a
    /// number exactly, and `NaN` makes all four `false`.
    #[test]
    fn relational_with_objects() {
        let two = || value_of(2.0.to_any());
        assert_eq!(value_of(1.0.to_any()).lt(two()), Ok(true.to_any()));
        assert_eq!(two().gt(value_of(1.0.to_any())), Ok(true.to_any()));
        assert_eq!(two().le(two()), Ok(true.to_any()));
        assert_eq!(two().ge(two()), Ok(true.to_any()));
        assert_eq!(two().lt(two()), Ok(false.to_any()));
        // `toString` answers a string, so `"b" < "c"` is a string comparison:
        // `"10" < "9"`, though `10 > 9`.
        assert_eq!(to_string_of(s("b")).lt(s("c")), Ok(true.to_any()));
        assert_eq!(
            to_string_of(s("10")).lt(to_string_of(s("9"))),
            Ok(true.to_any())
        );
        assert_eq!(value_of(s("10")).lt(9.0.to_any()), Ok(false.to_any()));
        assert_eq!(big(1).lt(two()), Ok(true.to_any()));
        assert_eq!(value_of(big(3)).gt(2.0.to_any()), Ok(true.to_any()));
        assert_eq!(value_of(big(3)).ge(value_of(big(3))), Ok(true.to_any()));
        // `NaN`, and a string no `BigInt` reads, answer `false` for all four.
        for nan in [value_of(Number::NAN.to_any()), value_of(s("x"))] {
            for r in [
                nan.clone().lt(1.0.to_any()),
                nan.clone().gt(1.0.to_any()),
                nan.clone().le(1.0.to_any()),
                nan.clone().ge(1.0.to_any()),
                1.0.to_any().lt(nan.clone()),
                1.0.to_any().ge(nan.clone()),
            ] {
                assert_eq!(r, Ok(false.to_any()));
            }
        }
        assert_eq!(value_of(s("x")).lt(big(1)), Ok(false.to_any()));
        assert_eq!(value_of(s("x")).ge(big(1)), Ok(false.to_any()));
        // A throw is the operator's, from either side.
        let t = |v| with(&[("valueOf", throws(v))]);
        refused(t("l").lt(1.0.to_any()), "l");
        refused(1.0.to_any().lt(t("r")), "r");
        refused(1.0.to_any().ge(t("r")), "r");
    }

    /// An array converts through its elements with the `string` hint, so an
    /// element's `toString` counts, its `valueOf` does not, and a throw
    /// reaches every operator.
    #[test]
    fn array_elements_are_converted() {
        let arr = |items: Vec<Any<A>>| items.to_array().to_any::<A>();
        assert_eq!(
            arr(vec![to_string_of(s("x")), 1.0.to_any()]).to_string(),
            Ok("x,1".into())
        );
        assert_eq!(
            arr(vec![value_of(1.0.to_any())]).to_string(),
            Ok("[object Object]".into())
        );
        assert_eq!(arr(vec![to_string_of(s("x"))]) + 1.0.to_any(), Ok(s("x1")));
        assert_eq!(-arr(vec![to_string_of(s("5"))]), Ok((-5.0).to_any()));
        assert_eq!(
            arr(vec![to_string_of(s("5"))]).to_number(),
            Ok(Number::from(5.0))
        );
        assert!(is_nan(arr(vec![value_of(5.0.to_any())]).to_number()));
        assert_eq!(
            arr(vec![to_string_of(s("1"))]).lt(arr(vec![to_string_of(s("2"))])),
            Ok(true.to_any())
        );
        let nested = arr(vec![arr(vec![
            to_string_of(s("n")),
            Nullish::Null.to_any(),
        ])]);
        assert_eq!(nested.to_string(), Ok("n,".into()));
        for r in [
            arr(vec![1.0.to_any(), boom()]).to_string().map(|_| ()),
            arr(vec![arr(vec![boom()])]).to_number().map(|_| ()),
            (arr(vec![boom()]) + 1.0.to_any()).map(|_| ()),
            (1.0.to_any() - arr(vec![boom()])).map(|_| ()),
            (-arr(vec![boom()])).map(|_| ()),
            arr(vec![boom()]).lt(1.0.to_any()).map(|_| ()),
        ] {
            assert_eq!(r, Err("boom".into()));
        }
        // An element's result that is no primitive is refused.
        refused(
            arr(vec![to_string_of(arr(vec![]))]).to_string(),
            CANNOT_CONVERT_TO_PRIMITIVE_VALUE,
        );
    }

    /// What needs no primitive never converts: a throwing object is only
    /// refused where `ToPrimitive` is asked.
    #[test]
    fn no_conversion_where_none_is_asked() {
        let o = boom;
        assert!(o().to_boolean());
        assert_eq!(!o(), Ok(false.to_any()));
        assert_eq!(o().typeof_(), Ok(s("object")));
        assert_eq!(o().logical_and(|| Ok(1.0.to_any())), Ok(1.0.to_any()));
        assert!(o().logical_or(|| Ok(1.0.to_any())).is_ok());
        assert_eq!(o().entry(s("a")), Ok(Any::undefined()));
        // `===` compares by identity.
        let x = o();
        assert!(x == x.clone());
        assert!(o() != o());
        // An own method is read, never called, by a member access.
        let m = with(&[("toString", throws("boom"))]);
        assert!(m.dot("toString".into()).end().is_ok());
    }

    /// An own method gets no arguments, and the conversion calls it once per
    /// method it reaches.
    #[test]
    fn method_gets_no_arguments() {
        let arity = A::static_function(
            |_, args| Ok(Number::from(args.length() as f64).to_any()),
            0,
            [].to_array(),
            None,
        )
        .to_any();
        assert_eq!(
            with(&[("valueOf", arity.clone())]).to_number(),
            Ok(Number::from(0.0))
        );
        assert_eq!(with(&[("toString", arity)]).to_string(), Ok("0".into()));
    }

    /// Whatever else an own `toString` or `valueOf` holds is skipped, an
    /// object, an array or a nullish value included.
    #[test]
    fn every_non_function_is_skipped() {
        let others = [
            Nullish::Null.to_any(),
            Any::undefined(),
            true.to_any(),
            big(1),
            [].to_array().to_any(),
            with(&[]),
        ];
        for v in others {
            let o = || with(&[("valueOf", v.clone())]);
            assert_eq!(o().to_string(), Ok("[object Object]".into()));
            assert!(is_nan(o().to_number()));
            let o = || with(&[("toString", v.clone())]);
            refused(o().to_string(), CANNOT_CONVERT_TO_PRIMITIVE_VALUE);
            refused(o() + 1.0.to_any(), CANNOT_CONVERT_TO_PRIMITIVE_VALUE);
            // `valueOf` is still reached first, and answers.
            let o = || with(&[("toString", v.clone()), ("valueOf", returns(4.0.to_any()))]);
            assert_eq!(o().to_number(), Ok(Number::from(4.0)));
            // The `string` hint skips it too, and `valueOf` answers.
            assert_eq!(o().to_string(), Ok("4".into()));
        }
    }

    /// A method's result is never converted, even a function that has a
    /// text, and the next method's throw is the conversion's.
    #[test]
    fn result_is_not_converted() {
        for result in [texted(), with(&[("toString", returns(s("a")))])] {
            let o = || with(&[("toString", returns(result.clone()))]);
            refused(o().to_string(), CANNOT_CONVERT_TO_PRIMITIVE_VALUE);
            refused(o().to_number(), CANNOT_CONVERT_TO_PRIMITIVE_VALUE);
            let o = || {
                with(&[
                    ("valueOf", returns(result.clone())),
                    ("toString", throws("t")),
                ])
            };
            refused(o().to_number(), "t");
            refused(o().to_string(), "t");
        }
        let o = with(&[
            ("valueOf", returns(with(&[]))),
            ("toString", returns(with(&[]))),
        ]);
        refused(o.clone().to_number(), CANNOT_CONVERT_TO_PRIMITIVE_VALUE);
        refused(o + 1.0.to_any(), CANNOT_CONVERT_TO_PRIMITIVE_VALUE);
    }

    /// A conversion whose result is discarded still runs the methods, so
    /// their throws, and their non-primitive results, are the call's.
    #[test]
    fn discarded_conversion_still_throws() {
        let empty = || [].to_array().to_any::<A>();
        refused(call(empty(), "join", vec![boom()]), "boom");
        refused(
            call(empty(), "join", vec![to_string_of(with(&[]))]),
            CANNOT_CONVERT_TO_PRIMITIVE_VALUE,
        );
        refused(
            call(empty(), "join", vec![[boom()].to_array().to_any()]),
            "boom",
        );
        assert_eq!(call(empty(), "join", vec![function()]), Ok(s("")));
        assert_eq!(
            call(s("a"), "split", vec![to_string_of(s("a")), 0.0.to_any()]).map(|a| a.to_string()),
            Ok(Ok("".into()))
        );
        refused(call(s("a"), "split", vec![boom(), 0.0.to_any()]), "boom");
        // The limit converts before the separator, as `split` does.
        let t = |v| with(&[("valueOf", throws(v))]);
        refused(call(s("a"), "split", vec![t("sep"), t("limit")]), "limit");
    }

    /// The converted value, not only the conversion, reaches the member.
    #[test]
    fn member_arguments_use_the_value() {
        let abc = || s("abc");
        let one = || value_of(1.0.to_any());
        let text = |r: Result<Any<A>, Any<A>>| r.and_then(Any::to_string);
        let arr = || {
            [1.0.to_any(), 2.0.to_any(), 3.0.to_any()]
                .to_array()
                .to_any::<A>()
        };
        assert_eq!(text(call(abc(), "charAt", vec![one()])), Ok("b".into()));
        assert_eq!(text(call(abc(), "slice", vec![one()])), Ok("bc".into()));
        assert_eq!(
            text(call(abc(), "repeat", vec![value_of(2.0.to_any())])),
            Ok("abcabc".into())
        );
        assert_eq!(
            text(call(
                abc(),
                "padStart",
                vec![value_of(5.0.to_any()), to_string_of(s("-"))]
            )),
            Ok("--abc".into())
        );
        assert_eq!(
            text(call(abc(), "concat", vec![to_string_of(s("d"))])),
            Ok("abcd".into())
        );
        assert_eq!(
            call(abc(), "indexOf", vec![to_string_of(s("c"))]),
            Ok(2.0.to_any())
        );
        assert_eq!(
            call(abc(), "startsWith", vec![to_string_of(s("b")), one()]),
            Ok(true.to_any())
        );
        assert_eq!(
            call(arr(), "at", vec![value_of((-1.0).to_any())]),
            Ok(3.0.to_any())
        );
        assert_eq!(
            call(arr(), "indexOf", vec![2.0.to_any(), one()]),
            Ok(1.0.to_any())
        );
        assert_eq!(
            text(call(arr(), "join", vec![to_string_of(s("+"))])),
            Ok("1+2+3".into())
        );
        assert_eq!(
            text(call(1.5.to_any(), "toFixed", vec![one()])),
            Ok("1.5".into())
        );
        assert_eq!(
            text(call(
                255.0.to_any(),
                "toString",
                vec![value_of(16.0.to_any())]
            )),
            Ok("ff".into())
        );
    }
}
