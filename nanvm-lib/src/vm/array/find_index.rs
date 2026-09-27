use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Function, IVm},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.findIndex(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.findindex>): the index of the
    /// first element whose callback answers truthy, or `None`.
    pub(crate) fn find_index(&self, f: &Function<A>) -> Result<Option<u32>, Any<A>> {
        self.position(f, 0..self.length(), true)
    }
}
