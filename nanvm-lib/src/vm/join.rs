use super::String16;
use crate::{
    common::iter::Iter,
    vm::{Any, IVm, ToString16},
};

pub trait Join<A: IVm>: Sized + Iterator<Item = Result<String16<A>, Any<A>>> {
    fn join(self, separator: String16<A>) -> Result<String16<A>, Any<A>> {
        self.intersperse_(Ok(separator))
            .try_flatten()
            .try_to_string16()
    }
}

impl<A: IVm, T: Sized + Iterator<Item = Result<String16<A>, Any<A>>>> Join<A> for T {}
