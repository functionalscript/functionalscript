use crate::{
    nullish::Nullish,
    vm::{
        any::Any, dispatch::Dispatch, primitive::Primitive,
        primitive_coercion::ToPrimitivePreferredType, Array, BigInt, Function, IVm, Object, String,
        ToAny,
    },
};

/// Coerces the value to a `String16<A>`, possibly producing an error result.
/// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion>
/// <https://tc39.es/ecma262/#sec-tostring>
///
/// It equals to `self + ''` in JavaScript.
///
/// Notes:
/// 1. It can throw an error. For example: `{ toString: () => { throw 0 } } + ''`
pub struct StringCoercion;

fn any_to_string<A: IVm>(a: Any<A>) -> Result<String<A>, Any<A>> {
    // https://tc39.es/ecma262/#sec-tostring - starting from point 10:
    // 10. Let primValue be ? ToPrimitive(argument, STRING).
    // (here we call to_primitive with preferred type String)
    // 11. Assert: primValue is not an Object.
    // (handled by to_primitive)
    // 12. Return ? ToString(primValue).
    // (handled by calls to relevant methods of StringCoercion)
    match a.to_primitive(Some(ToPrimitivePreferredType::String))? {
        Primitive::Nullish(n) => StringCoercion.nullish(n),
        Primitive::Boolean(b) => StringCoercion.bool(b),
        Primitive::Number(n) => StringCoercion.number(n),
        Primitive::String(s) => StringCoercion.string(s),
        Primitive::BigInt(bi) => StringCoercion.bigint(bi),
    }
}

impl<A: IVm> Dispatch<A> for StringCoercion {
    type Result = Result<String<A>, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        to_result(match v {
            Nullish::Null => "null",
            Nullish::Undefined => "undefined",
        })
    }

    fn bool(self, v: bool) -> Self::Result {
        to_result(match v {
            true => "true",
            false => "false",
        })
    }

    fn number(self, v: f64) -> Self::Result {
        match v {
            f64::INFINITY => to_result("Infinity"),
            f64::NEG_INFINITY => to_result("-Infinity"),
            -0.0 => to_result("0"),
            v => to_result(&v.to_string()),
        }
    }

    fn string(self, v: String<A>) -> Self::Result {
        Ok(v)
    }

    fn bigint(self, v: BigInt<A>) -> Self::Result {
        // TODO: we should use different algorithm for large numbers.
        to_result(&format!("{v:?}"))
    }

    fn object(self, v: Object<A>) -> Self::Result {
        any_to_string(v.to_any())
    }

    fn array(self, v: Array<A>) -> Self::Result {
        any_to_string(v.to_any())
    }

    fn function(self, v: Function<A>) -> Self::Result {
        any_to_string(v.to_any())
    }
}

fn to_result<A: IVm>(s: &str) -> Result<String<A>, Any<A>> {
    Ok(s.into())
}
