use crate::{
    nullish::Nullish,
    vm::{any::Any, dispatch::Dispatch, join::Join, Array, BigInt, Function, IVm, Object, String},
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

    fn object(self, _: Object<A>) -> Self::Result {
        // TODO: invoke user-defined methods Symbol.toPrimitive, toString, valueOf.
        to_result("[object Object]")
    }

    fn array(self, v: Array<A>) -> Self::Result {
        v.into_iter().map(|v| v.coerce_to_string()).join(",".into())
    }

    fn function(self, _: Function<A>) -> Self::Result {
        // TODO: invoke user-defined methods Symbol.toPrimitive, toString, valueOf.
        to_result("[object Function]")
    }
}

fn to_result<A: IVm>(s: &str) -> Result<String<A>, Any<A>> {
    Ok(s.into())
}
