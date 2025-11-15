use crate::{
    nullish::Nullish,
    vm::{any::Any, dispatch::Dispatch, Array, BigInt, Function, IVm, Object, String16},
};

/// Coerces the value to f64, possibly producing an error result.
/// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion>
/// <https://tc39.es/ecma262/#sec-tonumber>
///
/// It equals to `+self` in JavaScript.
///
/// Note: the function can return an error (JS throw). For example, `+(7n)`.
pub struct NumberCoercion;

impl<A: IVm> Dispatch<A> for NumberCoercion {
    type Result = Result<f64, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        Ok(match v {
            Nullish::Null => 0.0,
            Nullish::Undefined => f64::NAN,
        })
    }

    fn bool(self, v: bool) -> Self::Result {
        Ok(to_f64(v))
    }

    fn number(self, v: f64) -> Self::Result {
        Ok(v)
    }

    fn string(self, _: String16<A>) -> Self::Result {
        todo!()
        // let s: String = self.into();
        // let trimmed = s.trim();
        // if trimmed.is_empty() {
        //     return Ok(0.0);
        // }
        // match trimmed.parse::<f64>() {
        //     Ok(v) => Ok(v),
        //     Err(_) => Err(Any(A::from(Unpacked::NaN))),
        // }
    }

    fn bigint(self, _: BigInt<A>) -> Self::Result {
        Err("TypeError: Cannot convert a BigInt value to a number".into())
    }

    fn object(self, _: Object<A>) -> Self::Result {
        // TODO:
        todo!()
    }

    fn array(self, _: Array<A>) -> Self::Result {
        // TODO:
        todo!()
    }

    fn function(self, _: Function<A>) -> Self::Result {
        // TODO:
        todo!()
    }
}

fn to_f64(v: bool) -> f64 {
    v as u8 as f64
}

#[cfg(test)]
mod test {
    use crate::vm::number_coercion::to_f64;

    #[test]
    fn test() {
        assert_eq!(to_f64(true), 1.0);
        assert_eq!(to_f64(false), 0.0);
    }
}
