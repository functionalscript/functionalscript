use super::Array;
use crate::vm::{Any, Function, IVm, Nullish, ToAny};

impl<A: IVm> Array<A> {
    /// `Array.prototype.find(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.find>): the first element
    /// whose callback answers truthy, or `undefined`.
    pub(crate) fn find(&self, f: &Function<A>) -> Result<Any<A>, Any<A>> {
        Ok(self.element(self.find_index(f)?))
    }

    /// `Array.prototype.findLast(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.findlast>): the last
    /// element whose callback answers truthy, visiting from the end, or
    /// `undefined`.
    pub(crate) fn find_last(&self, f: &Function<A>) -> Result<Any<A>, Any<A>> {
        Ok(self.element(self.find_last_index(f)?))
    }

    /// The element a search found, or `undefined`.
    fn element(&self, i: Option<u32>) -> Any<A> {
        i.map_or_else(|| Nullish::Undefined.to_any(), |i| self[i].clone())
    }
}
