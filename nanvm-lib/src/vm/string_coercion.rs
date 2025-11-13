use crate::{
    nullish::Nullish,
    vm::{
        any::Any, string16::Join, unpacked::Dispatch, Array, BigInt, Function, IVm, Object,
        String16,
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

impl<A: IVm> Dispatch<A> for StringCoercion {
    type Result = Result<String16<A>, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        match v {
            Nullish::Null => "null",
            Nullish::Undefined => "undefined",
        }
        .to_string16_result()
    }

    fn bool(self, v: bool) -> Self::Result {
        match v {
            true => "true",
            false => "false",
        }
        .to_string16_result()
    }

    fn number(self, v: f64) -> Self::Result {
        match v {
            f64::INFINITY => "Infinity".to_string16_result(),
            f64::NEG_INFINITY => "-Infinity".to_string16_result(),
            -0.0 => "0".to_string16_result(),
            v => v.to_string().to_string16_result(),
        }
    }

    fn string(self, v: String16<A>) -> Self::Result {
        Ok(v)
    }

    fn bigint(self, v: BigInt<A>) -> Self::Result {
        // TODO: we should use different algorithm for large numbers.
        format!("{v:?}").to_string16_result()
    }

    fn object(self, _: Object<A>) -> Self::Result {
        // TODO: invoke user-defined methods Symbol.toPrimitive, toString, valueOf.
        "[object Object]".to_string16_result()
    }

    fn array(self, v: Array<A>) -> Self::Result {
        v.into_iter().map(|v| v.coerce_to_string()).join(",".into())
    }

    fn function(self, _: Function<A>) -> Self::Result {
        // TODO: invoke user-defined methods Symbol.toPrimitive, toString, valueOf.
        "[object Function]".to_string16_result()
    }
}

trait ToString16Result<A: IVm> {
    fn to_string16_result(self) -> Result<String16<A>, Any<A>>;
}

impl<A: IVm> ToString16Result<A> for &str {
    fn to_string16_result(self) -> Result<String16<A>, Any<A>> {
        Ok(self.into())
    }
}
