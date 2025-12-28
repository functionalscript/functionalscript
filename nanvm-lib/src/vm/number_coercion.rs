use core::f64;

use crate::{
    nullish::Nullish,
    vm::{
        any::Any, dispatch::Dispatch, primitive::Primitive,
        primitive_coercion::ToPrimitivePreferredType, Array, BigInt, Function, IVm, Object, String,
        ToAny,
    },
};

/// Coerces the value to f64, possibly producing an error result.
/// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion>
/// <https://tc39.es/ecma262/#sec-tonumber>
///
/// It equals to `+self` in JavaScript.
///
/// Note: the function can return an error (JS throw). For example, `+(7n)`.
pub struct NumberCoercion;

fn any_to_number<A: IVm>(a: Any<A>) -> Result<f64, Any<A>> {
    // https://tc39.es/ecma262/#sec-tonumber - starting from point 8:
    // 8. Let primValue be ? ToPrimitive(argument, number).
    // (here we call to_primitive with preferred type Number)
    // 9. Assert: primValue is not an Object.
    // (handled by to_primitive)
    // 10. Return ? ToNumber(primValue).
    // (handled by calls to relevant methods of NumberCoercion)
    match a.to_primitive(Some(ToPrimitivePreferredType::Number))? {
        Primitive::Nullish(n) => NumberCoercion.nullish(n),
        Primitive::Boolean(b) => NumberCoercion.bool(b),
        Primitive::Number(n) => NumberCoercion.number(n),
        Primitive::String(s) => NumberCoercion.string(s),
        Primitive::BigInt(bi) => NumberCoercion.bigint(bi),
    }
}

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

    fn string(self, v: String<A>) -> Self::Result {
        // https://tc39.es/ecma262/#sec-stringtonumber
        // TODO: binary, octal, hex parsing
        let s: std::string::String = v.into();
        let trimmed = s.trim();
        if trimmed.is_empty() {
            return Ok(0.0);
        }
        match trimmed.parse::<f64>() {
            Ok(v) => Ok(v),
            Err(_) => Ok(f64::NAN),
        }
    }

    fn bigint(self, _: BigInt<A>) -> Self::Result {
        Err("TypeError: Cannot convert a BigInt value to a number".into())
    }

    fn object(self, v: Object<A>) -> Self::Result {
        any_to_number(v.to_any())
    }

    fn array(self, v: Array<A>) -> Self::Result {
        any_to_number(v.to_any())
    }

    fn function(self, v: Function<A>) -> Self::Result {
        any_to_number(v.to_any())
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
