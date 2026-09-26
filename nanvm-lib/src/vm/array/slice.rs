use super::{
    Array,
    relative::{clamped, relative},
};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, Nullish, ToArray, Unpacked},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.slice(start, end)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.slice>): a new array of
    /// the elements from `start` up to, not including, `end`. Both are
    /// [`relative`] positions clamped into the array, `start` converted
    /// first; `end` is the length when `undefined`. An empty range is `[]`.
    pub(crate) fn slice(&self, start: Any<A>, end: Any<A>) -> Result<Array<A>, Any<A>> {
        let len = self.length();
        let from = clamped(relative(start, len)?, len);
        let to = if matches!(
            Unpacked::from(end.clone()),
            Unpacked::Nullish(Nullish::Undefined)
        ) {
            len
        } else {
            clamped(relative(end, len)?, len)
        };
        Ok((from..to.max(from)).map(|i| self[i].clone()).to_array())
    }
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, ToAny, ToArray},
    };

    type A = Naive;

    fn array() -> Array<A> {
        [1.0.to_any(), 2.0.to_any(), 3.0.to_any()].to_array()
    }
    fn slice(start: f64, end: Any<A>) -> Vec<Any<A>> {
        array()
            .slice(start.to_any(), end)
            .unwrap()
            .into_iter()
            .collect()
    }

    #[test]
    fn ranges() {
        let undefined = || Nullish::Undefined.to_any();
        assert_eq!(slice(1.0, undefined()), vec![2.0.to_any(), 3.0.to_any()]);
        assert_eq!(slice(0.0, 2.0.to_any()), vec![1.0.to_any(), 2.0.to_any()]);
        assert_eq!(slice(-2.0, (-1.0f64).to_any()), vec![2.0.to_any()]);
        assert_eq!(slice(2.0, 1.0.to_any()), vec![]);
        assert_eq!(slice(-9.0, 9.0.to_any()).len(), 3);
        assert_eq!(slice(0.0, Nullish::Null.to_any()), vec![]);
    }
}
