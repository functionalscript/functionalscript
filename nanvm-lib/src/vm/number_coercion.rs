use core::f64;

use crate::{
    nullish::Nullish,
    vm::{any::Any, dispatch::Dispatch, Array, BigInt, Function, IVm, Object, String, ToAny},
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

    fn object(self, o: Object<A>) -> Self::Result {
        // Per ECMAScript spec, objects are converted to primitives via ToPrimitive
        // with hint "number", which typically calls valueOf() then toString().
        // Since this VM doesn't support calling custom methods, we use the default
        // Object.prototype.toString() which returns "[object Object]", and that
        // converts to NaN.
        // https://tc39.es/ecma262/#sec-tonumber
        // https://tc39.es/ecma262/#sec-toprimitive
        self.via_string_coercion(o)
    }

    fn array(self, a: Array<A>) -> Self::Result {
        // Per ECMAScript spec, arrays are converted to primitives via ToPrimitive
        // with hint "number", which for arrays uses toString() (joining elements).
        // The resulting string is then converted to a number.
        // Examples: [] -> "" -> 0, [5] -> "5" -> 5, [1,2] -> "1,2" -> NaN
        // https://tc39.es/ecma262/#sec-tonumber
        // https://tc39.es/ecma262/#sec-toprimitive
        self.via_string_coercion(a)
    }

    fn function(self, f: Function<A>) -> Self::Result {
        // Per ECMAScript spec, functions are converted to primitives via ToPrimitive
        // with hint "number", which typically calls valueOf() then toString().
        // Function.prototype.toString() returns a string like "function(){}", which
        // converts to NaN.
        // https://tc39.es/ecma262/#sec-tonumber
        // https://tc39.es/ecma262/#sec-toprimitive
        self.via_string_coercion(f)
    }
}

impl NumberCoercion {
    /// Helper method to convert values to numbers via string coercion.
    /// Used for objects, arrays, and functions.
    fn via_string_coercion<A: IVm, T: ToAny>(self, value: T) -> Result<f64, Any<A>>
    where
        T: Into<A>,
    {
        let s = value.to_any().to_string()?;
        self.string(s)
    }
}

fn to_f64(v: bool) -> f64 {
    v as u8 as f64
}

#[cfg(test)]
mod test {
    use crate::vm::{naive::Naive, number_coercion::to_f64, Any, ToAny, ToArray};

    #[test]
    fn test_bool_to_f64() {
        assert_eq!(to_f64(true), 1.0);
        assert_eq!(to_f64(false), 0.0);
    }

    #[test]
    fn test_array_coercion() {
        // Empty array should convert to 0 ([] -> "" -> 0)
        let a: Any<Naive> = [].to_array().to_any();
        let result = a.to_number().unwrap();
        assert_eq!(result, 0.0);

        // Single element array should convert to that element's number value
        // [5] -> "5" -> 5
        let a: Any<Naive> = [5.0.to_any()].to_array().to_any();
        let result = a.to_number().unwrap();
        assert_eq!(result, 5.0);

        // Array with string "10" should convert to 10
        // ["10"] -> "10" -> 10
        let a: Any<Naive> = ["10".into()].to_array().to_any();
        let result = a.to_number().unwrap();
        assert_eq!(result, 10.0);

        // Array with multiple elements should convert to NaN
        // [1, 2] -> "1,2" -> NaN
        let a: Any<Naive> = [1.0.to_any(), 2.0.to_any()].to_array().to_any();
        let result = a.to_number().unwrap();
        assert!(result.is_nan());

        // Array with nested empty array should convert to 0
        // [[]] -> "" -> 0
        let inner: Any<Naive> = [].to_array().to_any();
        let a: Any<Naive> = [inner].to_array().to_any();
        let result = a.to_number().unwrap();
        assert_eq!(result, 0.0);
    }

    #[test]
    fn test_object_coercion() {
        use crate::vm::ToObject;

        // Empty object should convert to NaN
        // {} -> "[object Object]" -> NaN
        let o: Any<Naive> = [].to_object().to_any();
        let result = o.to_number().unwrap();
        assert!(result.is_nan());

        // Object with properties should also convert to NaN
        let o: Any<Naive> = [("a".into(), 1.0.to_any())].to_object().to_any();
        let result = o.to_number().unwrap();
        assert!(result.is_nan());
    }

    #[test]
    fn test_function_coercion() {
        use crate::vm::{Function, IContainer};

        // Function should convert to NaN
        // function -> "[object Function]" -> NaN
        let f_internal =
            <Naive as crate::vm::IVm>::InternalFunction::new_ok(("test".into(), 0), []);
        let f: Any<Naive> = Function::<Naive>(f_internal).to_any();
        let result = f.to_number().unwrap();
        assert!(result.is_nan());
    }
}
