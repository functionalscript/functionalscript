use crate::vm::number_coercion::NumberCoercion;

use super::{Any, IVm};

impl<A: IVm> NumberCoercion<A> for f64 {
    fn coerce_to_number(self) -> Result<f64, Any<A>> {
        Ok(self)
    }
}
