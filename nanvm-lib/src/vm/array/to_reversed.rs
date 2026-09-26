use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{IVm, ToArray},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.toReversed()`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.toreversed>): a new
    /// array of the elements in reverse order.
    pub(crate) fn to_reversed(&self) -> Array<A> {
        (0..self.length()).rev().map(|i| self[i].clone()).to_array()
    }
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, ToArray},
    };

    type A = Naive;

    #[test]
    fn reverses() {
        let a: Array<A> = [1.0.to_any(), 2.0.to_any()].to_array();
        let r: Vec<Any<A>> = a.to_reversed().into_iter().collect();
        assert_eq!(r, vec![2.0.to_any(), 1.0.to_any()]);
        assert_eq!(Array::<A>::default().to_reversed().into_iter().count(), 0);
    }
}
