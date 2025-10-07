use crate::vm::string_coercion::ToString16Result;

use super::{string_coercion::StringCoercion, Any, IVm, String16};

impl<A: IVm> StringCoercion<A> for f64 {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        self.to_string().to_string16_result()
    }
}
