use std::ops::Add;

use crate::vm::{Any, IVm, ToAny, Unpacked, primitive::Primitive};

impl<A: IVm> Add for Any<A> {
    type Output = Result<Self, Self>;

    fn add(self, rhs: Self) -> Self::Output {
        let lhs = self.to_primitive(None)?;
        let rhs = rhs.to_primitive(None)?;
        if matches!(&lhs, Primitive::String(_)) || matches!(&rhs, Primitive::String(_)) {
            let lhs: Any<A> = Unpacked::from(lhs).into();
            let rhs: Any<A> = Unpacked::from(rhs).into();
            return Ok((lhs.to_string()? + rhs.to_string()?).to_any());
        }
        let lhs: Any<A> = Unpacked::from(lhs).into();
        let rhs: Any<A> = Unpacked::from(rhs).into();
        Ok(Unpacked::from((lhs.to_numeric()? + rhs.to_numeric()?)?).into())
    }
}
