use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Function, IVm},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.findLastIndex(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.findlastindex>): the index of
    /// the last element whose callback answers truthy, visiting from the end,
    /// or `None`.
    pub(crate) fn find_last_index(&self, f: &Function<A>) -> Result<Option<u32>, Any<A>> {
        self.position(f, (0..self.length()).rev(), true)
    }
}
