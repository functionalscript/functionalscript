use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Function, IVm},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.every(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.every>): whether the callback
    /// answers truthy for every element, stopping at the first that is not;
    /// `true` for an empty array.
    pub(crate) fn every(&self, f: &Function<A>) -> Result<bool, Any<A>> {
        Ok(self.position(f, 0..self.length(), false)?.is_none())
    }
}
