use core::f64;

use crate::{
    nullish::Nullish,
    vm::{any::Any, dispatch::Dispatch, Array, BigInt, Function, IVm, Object, String},
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

    fn string(self, _: String<A>) -> Self::Result {
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
        Ok(f64::NAN)
    }

    fn array(self, arr: Array<A>) -> Self::Result {
        use crate::common::sized_index::SizedIndex;

        let len = arr.length();
        if len == 0 {
            return Ok(0.0);
        }
        if len > 1 {
            return Ok(f64::NAN);
        }
        // Single element: recursively convert to number
        arr[0].clone().to_number()
    }

    fn function(self, _: Function<A>) -> Self::Result {
        Ok(f64::NAN)
    }
}

fn to_f64(v: bool) -> f64 {
    v as u8 as f64
}

#[cfg(test)]
mod test {
    use crate::vm::{
        naive::Naive, number_coercion::to_f64, Any, IContainer, ToAny, ToArray, ToObject,
    };

    #[test]
    fn test_bool() {
        assert_eq!(to_f64(true), 1.0);
        assert_eq!(to_f64(false), 0.0);
    }

    #[test]
    fn test_object() {
        // Empty object should convert to NaN
        let obj = [].to_object::<Naive>();
        let any: Any<Naive> = obj.to_any();
        let result = any.to_number();
        assert!(result.is_ok());
        assert!(result.unwrap().is_nan());
    }

    #[test]
    fn test_array_empty() {
        // Empty array should convert to 0
        let arr = [].to_array::<Naive>();
        let any: Any<Naive> = arr.to_any();
        let result = any.to_number();
        assert_eq!(result, Ok(0.0));
    }

    #[test]
    fn test_array_single_number() {
        // Single number element should convert to that number
        let arr = [42.0.to_any()].to_array::<Naive>();
        let any: Any<Naive> = arr.to_any();
        let result = any.to_number();
        assert_eq!(result, Ok(42.0));
    }

    #[test]
    fn test_array_single_bool() {
        // Single boolean element: recursively converts to number
        // Note: This is a simplified implementation. Full ECMAScript spec would
        // convert array to string first, making +[true] return NaN.
        let arr = [true.to_any()].to_array::<Naive>();
        let any: Any<Naive> = arr.to_any();
        let result = any.to_number();
        assert_eq!(result, Ok(1.0));
    }

    #[test]
    fn test_array_multiple() {
        // Multiple elements should convert to NaN
        let arr = [1.0.to_any(), 2.0.to_any()].to_array::<Naive>();
        let any: Any<Naive> = arr.to_any();
        let result = any.to_number();
        assert!(result.is_ok());
        assert!(result.unwrap().is_nan());
    }

    #[test]
    fn test_function() {
        // Functions should convert to NaN
        let func = crate::vm::Function::<Naive>(
            <Naive as crate::vm::IVm>::InternalFunction::new_ok(("test".into(), 0), []),
        );
        let any: Any<Naive> = func.to_any();
        let result = any.to_number();
        assert!(result.is_ok());
        assert!(result.unwrap().is_nan());
    }
}
