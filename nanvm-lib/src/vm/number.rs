use super::{string_coercion::StringCoercion, Any, IVm, String16};

impl<A: IVm> StringCoercion<A> for f64 {
    fn coerce_to_string(&self) -> Result<String16<A>, Any<A>> {
        Ok(self.to_string().as_str().into())
    }
}
