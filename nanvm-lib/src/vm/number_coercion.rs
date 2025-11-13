use crate::{
    nullish::Nullish,
    vm::{any::Any, IVm},
};

/// ECMAScript functions.
#[allow(dead_code)]
pub trait NumberCoercion<A: IVm>: Sized {
    /// Coerces the value to f64, possibly producing an error result.
    /// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#number_coercion>
    /// <https://tc39.es/ecma262/#sec-tonumber>
    ///
    /// It equals to `+self` in JavaScript.
    ///
    /// Note: the function can return an error (JS throw). For example, `+(7n)`.
    fn coerce_to_number(self) -> Result<f64, Any<A>>;
}

fn to_f64(v: bool) -> f64 {
    v as u8 as f64
}

impl<A: IVm> NumberCoercion<A> for bool {
    fn coerce_to_number(self) -> Result<f64, Any<A>> {
        Ok(to_f64(self))
    }
}

impl<A: IVm> NumberCoercion<A> for Nullish {
    fn coerce_to_number(self) -> Result<f64, Any<A>> {
        Ok(match self {
            Nullish::Null => 0.0,
            Nullish::Undefined => f64::NAN,
        })
    }
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
