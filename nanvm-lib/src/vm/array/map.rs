use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Function, IVm, ToArray},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.map(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.map>): a new array of the
    /// callback's results, in order; the first throw stops it and is the
    /// result.
    pub(crate) fn map(&self, f: &Function<A>) -> Result<Array<A>, Any<A>> {
        let results: Result<Vec<Any<A>>, Any<A>> =
            (0..self.length()).map(|i| self.visit(f, i)).collect();
        Ok(results?.to_array())
    }
}
