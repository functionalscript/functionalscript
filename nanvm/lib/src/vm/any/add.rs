use std::ops::Add;

use crate::vm::{Any, IVm, ToAny, numeric::Numeric, primitive::Primitive};

impl<A: IVm> Add for Any<A> {
    type Output = Result<Self, Self>;

    fn add(self, rhs: Self) -> Self::Output {
        let lhs = self.to_primitive(None)?;
        let rhs = rhs.to_primitive(None)?;
        let concat = matches!(&lhs, Primitive::String(_)) || matches!(&rhs, Primitive::String(_));
        let lhs: Any<A> = lhs.into();
        let rhs: Any<A> = rhs.into();
        if concat {
            return Ok((lhs.to_string()? + rhs.to_string()?).to_any());
        }
        lhs.numeric_op(rhs, Numeric::add)
    }
}
