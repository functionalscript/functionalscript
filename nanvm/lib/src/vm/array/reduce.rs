use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Function, IVm},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.reduce(f, initial)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.reduce>): the
    /// callback folded over the elements from the start; see
    /// [`fold`](Array::fold) for what `initial`'s absence means.
    pub(crate) fn reduce(
        &self,
        f: &Function<A>,
        initial: Option<Any<A>>,
    ) -> Result<Any<A>, Any<A>> {
        self.fold(f, initial, 0..self.length())
    }

    /// `Array.prototype.reduceRight(f, initial)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.reduceright>): the same,
    /// from the end.
    pub(crate) fn reduce_right(
        &self,
        f: &Function<A>,
        initial: Option<Any<A>>,
    ) -> Result<Any<A>, Any<A>> {
        self.fold(f, initial, (0..self.length()).rev())
    }
}
