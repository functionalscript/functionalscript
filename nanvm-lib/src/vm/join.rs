use super::String;
use crate::{
    common::iter::Iter,
    vm::{Any, IVm, ToString},
};

pub trait Join<A: IVm>: Sized + Iterator<Item = Result<String<A>, Any<A>>> {
    fn join(self, separator: String<A>) -> Result<String<A>, Any<A>> {
        self.intersperse_(Ok(separator))
            .try_flatten()
            .try_to_string()
    }
}

impl<A: IVm, T: Sized + Iterator<Item = Result<String<A>, Any<A>>>> Join<A> for T {}
