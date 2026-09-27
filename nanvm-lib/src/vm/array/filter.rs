use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Function, IVm, ToArray},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.filter(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.filter>): a new array of the
    /// elements whose callback answers truthy, in order.
    pub(crate) fn filter(&self, f: &Function<A>) -> Result<Array<A>, Any<A>> {
        let kept: Result<Vec<Option<Any<A>>>, Any<A>> = (0..self.length())
            .map(|i| Ok(self.visit(f, i)?.to_boolean().then(|| self[i].clone())))
            .collect();
        Ok(kept?.into_iter().flatten().to_array())
    }
}
