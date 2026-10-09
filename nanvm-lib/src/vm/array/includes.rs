use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{
        Any, IVm,
        position::{clamped, relative},
    },
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.includes(x, from)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.includes>): whether an
    /// element at or after `from` is `SameValueZero` to `x`, so `NaN` is
    /// found. `from` is a [`relative`] position clamped into the array, `0`
    /// for `undefined`. An empty array answers `false` before `from` is
    /// converted, so a bigint `from` throws only on a non-empty one.
    pub(crate) fn includes(&self, x: &Any<A>, from: Any<A>) -> Result<bool, Any<A>> {
        let len = self.length();
        if len == 0 {
            return Ok(false);
        }
        let k = clamped(relative(from, len)?, len);
        Ok((k..len).any(|i| self[i].same_value_zero(x)))
    }
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, ToArray, unstable::bigint_any},
    };

    type A = Naive;

    fn array() -> Array<A> {
        [1.0.to_any(), f64::NAN.to_any(), 3.0.to_any()].to_array()
    }
    #[test]
    fn finds_by_same_value_zero() {
        assert_eq!(array().includes(&3.0.to_any(), Any::undefined()), Ok(true));
        assert_eq!(
            array().includes(&f64::NAN.to_any(), Any::undefined()),
            Ok(true)
        );
        assert_eq!(array().includes(&2.0.to_any(), Any::undefined()), Ok(false));
        assert_eq!(array().includes(&"1".into(), Any::undefined()), Ok(false));
    }

    #[test]
    fn from_a_position() {
        assert_eq!(array().includes(&1.0.to_any(), 1.0.to_any()), Ok(false));
        assert_eq!(
            array().includes(&3.0.to_any(), (-1.0f64).to_any()),
            Ok(true)
        );
        assert_eq!(
            array().includes(&1.0.to_any(), (-9.0f64).to_any()),
            Ok(true)
        );
        assert_eq!(array().includes(&3.0.to_any(), 3.0.to_any()), Ok(false));
    }

    #[test]
    fn empty_answers_before_converting() {
        let one: Any<A> = bigint_any(1);
        assert_eq!(
            Array::<A>::default().includes(&1.0.to_any(), one.clone()),
            Ok(false)
        );
        assert!(array().includes(&1.0.to_any(), one).is_err());
    }
}
