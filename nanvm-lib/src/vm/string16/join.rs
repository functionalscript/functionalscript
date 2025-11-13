use super::String16;
use crate::{
    common::iter::Iter,
    vm::{internal::IContainer, Any, IVm},
};

pub trait Join<A: IVm>: Sized + Iterator<Item = Result<String16<A>, Any<A>>> {
    fn join(self, separator: String16<A>) -> Result<String16<A>, Any<A>> {
        let i = self.intersperse_(Ok(separator)).try_flatten();
        Ok(String16(A::InternalString16::new((), i)?))
    }
}

impl<A: IVm, T: Sized + Iterator<Item = Result<String16<A>, Any<A>>>> Join<A> for T {}
