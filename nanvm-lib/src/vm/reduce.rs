use crate::{common::default::default, vm::{Any, IVm}};

pub trait Reduce<A: IVm, I: Default>: Sized + Iterator<Item = Result<I, Any<A>>> {
    fn reduce_or_default(mut self, o: impl Fn(I, I) -> Result<I, Any<A>>) -> Result<I, Any<A>> {
        let mut res = match self.next() {
            None => return Ok(default()),
            Some(res) => res?
        };
        while let Some(v) = self.next() {
            res = o(res, v?)?
        }
        Ok(res)
    }
}

impl<A: IVm, I: Default, T: Sized + Iterator<Item = Result<I, Any<A>>>> Reduce<A, I> for T {}
