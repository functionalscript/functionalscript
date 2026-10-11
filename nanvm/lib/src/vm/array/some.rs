use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Function, IVm},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.some(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.some>): whether the callback
    /// answers truthy for some element, stopping at the first that does.
    pub(crate) fn some(&self, f: &Function<A>) -> Result<bool, Any<A>> {
        Ok(self.position(f, 0..self.length(), true)?.is_some())
    }
}
