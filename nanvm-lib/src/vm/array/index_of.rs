use super::{
    Array,
    relative::{clamped, relative},
};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.indexOf(x, from)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.indexof>): the first
    /// index at or after `from` whose element is `===` `x`, so `NaN` is never
    /// found and `0` finds `-0`, or `None`. `from` is a [`relative`] position
    /// clamped into the array, `0` for `undefined`. An empty array answers
    /// before `from` is converted.
    pub(crate) fn index_of(&self, x: &Any<A>, from: Any<A>) -> Result<Option<u32>, Any<A>> {
        let len = self.length();
        if len == 0 {
            return Ok(None);
        }
        let k = clamped(relative(from, len)?, len);
        Ok((k..len).find(|&i| self[i] == *x))
    }
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, ToAny, ToArray, unstable::bigint_any},
    };

    type A = Naive;

    fn array() -> Array<A> {
        [1.0.to_any(), f64::NAN.to_any(), 1.0.to_any(), 0.0.to_any()].to_array()
    }
    fn undefined() -> Any<A> {
        Nullish::Undefined.to_any()
    }

    #[test]
    fn finds_by_strict_equality() {
        assert_eq!(array().index_of(&1.0.to_any(), undefined()), Ok(Some(0)));
        assert_eq!(array().index_of(&f64::NAN.to_any(), undefined()), Ok(None));
        assert_eq!(
            array().index_of(&(-0.0f64).to_any(), undefined()),
            Ok(Some(3))
        );
    }

    #[test]
    fn from_a_position() {
        assert_eq!(array().index_of(&1.0.to_any(), 1.0.to_any()), Ok(Some(2)));
        assert_eq!(
            array().index_of(&1.0.to_any(), (-2.0f64).to_any()),
            Ok(Some(2))
        );
        assert_eq!(array().index_of(&1.0.to_any(), 4.0.to_any()), Ok(None));
    }

    #[test]
    fn empty_answers_before_converting() {
        let one: Any<A> = bigint_any(1);
        assert_eq!(
            Array::<A>::default().index_of(&1.0.to_any(), one.clone()),
            Ok(None)
        );
        assert!(array().index_of(&1.0.to_any(), one).is_err());
    }
}
