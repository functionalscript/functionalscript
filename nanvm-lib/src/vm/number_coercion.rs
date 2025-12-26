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

    fn object(self, _v: Object<A>) -> Self::Result {
        // Objects are first converted to primitive (which would call valueOf/toString),
        // but since those methods are not yet implemented, we use the default behavior
        // which is to return NaN.
        // See: https://tc39.es/ecma262/#sec-tonumber
        // This matches JavaScript behavior: +({}) === NaN
        Ok(f64::NAN)
    }

    fn array(self, v: Array<A>) -> Self::Result {
        // Arrays are first converted to string (comma-separated elements),
        // then that string is converted to number.
        // See: https://tc39.es/ecma262/#sec-tonumber
        // Examples:
        // - +[] === 0 (empty string -> 0)
        // - +[42] === 42 (string "42" -> 42)
        // - +[1,2] === NaN (string "1,2" -> NaN)
        let string_result = v.to_any().to_string()?;
        self.string(string_result)
    }

    fn function(self, _v: Function<A>) -> Self::Result {
        // Functions are first converted to primitive (which would call valueOf/toString),
        // but since those methods are not yet implemented, we use the default behavior
        // which is to return NaN.
        // See: https://tc39.es/ecma262/#sec-tonumber
        // This matches JavaScript behavior: +(function(){}) === NaN
        Ok(f64::NAN)
    }
}

fn to_f64(v: bool) -> f64 {
    v as u8 as f64
}

#[cfg(test)]
mod test {
    use crate::{
        nullish::Nullish,
        vm::{
            naive::Naive, number_coercion::to_f64, Any, Function, IContainer, IVm, ToAny, ToArray,
            ToObject,
        },
    };

    #[test]
    fn test_bool_to_f64() {
        assert_eq!(to_f64(true), 1.0);
        assert_eq!(to_f64(false), 0.0);
    }

    #[test]
    fn test_nullish_number_coercion() {
        let null: Any<Naive> = Nullish::Null.to_any();
        assert_eq!(null.to_number().unwrap(), 0.0);

        let undefined: Any<Naive> = Nullish::Undefined.to_any();
        assert!(undefined.to_number().unwrap().is_nan());
    }

    #[test]
    fn test_bool_number_coercion() {
        let t: Any<Naive> = true.to_any();
        assert_eq!(t.to_number().unwrap(), 1.0);

        let f: Any<Naive> = false.to_any();
        assert_eq!(f.to_number().unwrap(), 0.0);
    }

    #[test]
    fn test_number_number_coercion() {
        let n: Any<Naive> = 0.0.to_any();
        assert_eq!(n.to_number().unwrap(), 0.0);

        let n: Any<Naive> = 42.5.to_any();
        assert_eq!(n.to_number().unwrap(), 42.5);

        let n: Any<Naive> = (-42.5).to_any();
        assert_eq!(n.to_number().unwrap(), -42.5);

        let n: Any<Naive> = f64::NAN.to_any();
        assert!(n.to_number().unwrap().is_nan());

        let n: Any<Naive> = f64::INFINITY.to_any();
        assert_eq!(n.to_number().unwrap(), f64::INFINITY);
    }

    #[test]
    fn test_string_number_coercion() {
        let s: Any<Naive> = "".into();
        assert_eq!(s.to_number().unwrap(), 0.0);

        let s: Any<Naive> = "  ".into();
        assert_eq!(s.to_number().unwrap(), 0.0);

        let s: Any<Naive> = "42".into();
        assert_eq!(s.to_number().unwrap(), 42.0);

        let s: Any<Naive> = "-42.5".into();
        assert_eq!(s.to_number().unwrap(), -42.5);

        let s: Any<Naive> = "2.3e2".into();
        assert_eq!(s.to_number().unwrap(), 230.0);

        let s: Any<Naive> = "not a number".into();
        assert!(s.to_number().unwrap().is_nan());
    }

    #[test]
    fn test_object_number_coercion() {
        // Empty object should convert to NaN
        let obj: Any<Naive> = [].to_object().to_any();
        assert!(obj.to_number().unwrap().is_nan());

        // Object with properties also converts to NaN
        let obj: Any<Naive> = [("a".into(), 1.0.to_any())].to_object().to_any();
        assert!(obj.to_number().unwrap().is_nan());
    }

    #[test]
    fn test_array_number_coercion() {
        // Empty array should convert to 0 ([] -> "" -> 0)
        let arr: Any<Naive> = [].to_array().to_any();
        assert_eq!(arr.to_number().unwrap(), 0.0);

        // Array with single number ([42] -> "42" -> 42)
        let arr: Any<Naive> = [42.0.to_any()].to_array().to_any();
        assert_eq!(arr.to_number().unwrap(), 42.0);

        // Array with single string that is a number (["42"] -> "42" -> 42)
        let s: Any<Naive> = "42".into();
        let arr: Any<Naive> = [s].to_array().to_any();
        assert_eq!(arr.to_number().unwrap(), 42.0);

        // NOTE: In JavaScript, [null] -> "" -> 0, but the current string coercion
        // implementation has a bug where it converts null to "null" instead of ""
        // during array stringification. So [null] -> "null" -> NaN.
        // This is a pre-existing bug in string_coercion.rs, not in number_coercion.
        // When that's fixed, this test should expect 0.0 instead of NaN.
        let null: Any<Naive> = Nullish::Null.to_any();
        let arr: Any<Naive> = [null].to_array().to_any();
        assert!(arr.to_number().unwrap().is_nan()); // Should be 0.0 when string coercion is fixed

        // Array with multiple elements should convert to NaN ([1,2] -> "1,2" -> NaN)
        let arr: Any<Naive> = [1.0.to_any(), 2.0.to_any()].to_array().to_any();
        assert!(arr.to_number().unwrap().is_nan());

        // Array with negative number ([-42.5] -> "-42.5" -> -42.5)
        let arr: Any<Naive> = [(-42.5).to_any()].to_array().to_any();
        assert_eq!(arr.to_number().unwrap(), -42.5);

        // Array with string containing spaces ([" "] -> " " -> 0)
        let s: Any<Naive> = " ".into();
        let arr: Any<Naive> = [s].to_array().to_any();
        assert_eq!(arr.to_number().unwrap(), 0.0);
    }

    #[test]
    fn test_function_number_coercion() {
        // Function should convert to NaN
        fn create_test_function() -> Function<Naive> {
            // Create a simple function: name "f", arity 0, bytecode [0]
            Function::<Naive>(<Naive as IVm>::InternalFunction::new_ok(
                ("f".into(), 0),
                [0],
            ))
        }
        let func_any: Any<Naive> = create_test_function().to_any();
        assert!(func_any.to_number().unwrap().is_nan());
    }

    #[test]
    fn test_bigint_number_coercion() {
        // BigInt should throw a TypeError
        let bi: Any<Naive> = Into::<crate::vm::BigInt<Naive>>::into(1u64).to_any();
        let result = bi.to_number();
        assert!(result.is_err());
        // Verify the error contains the TypeError message
        let err = result.unwrap_err();
        let err_str: crate::vm::String<Naive> = err.to_string().unwrap();
        let err_string: std::string::String = err_str.into();
        assert!(err_string.contains("TypeError"));
        assert!(err_string.contains("BigInt"));
    }
}
