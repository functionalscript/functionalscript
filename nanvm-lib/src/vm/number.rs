use crate::vm::{number_coercion::NumberCoercion, string_coercion::ToString16Result};

use super::{string_coercion::StringCoercion, Any, IVm, String16};

impl<A: IVm> StringCoercion<A> for f64 {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        match self {
            f64::INFINITY => "Infinity".to_string16_result(),
            f64::NEG_INFINITY => "-Infinity".to_string16_result(),
            -0.0 => "0".to_string16_result(),
            v => v.to_string().to_string16_result(),
        }
    }
}

impl<A: IVm> NumberCoercion<A> for f64 {
    fn coerce_to_number(self) -> Result<f64, Any<A>> {
        Ok(self)
    }
}
