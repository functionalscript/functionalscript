use super::{Array, relative::relative};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.lastIndexOf(x, from)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.lastindexof>): the last
    /// index at or before `from` whose element is `===` `x`, or `None`.
    ///
    /// `from` is `None` when the call passed none, and then the search starts
    /// at the end. A passed `undefined` is not the same: it converts to `0`,
    /// so `[1, 1].lastIndexOf(1, undefined)` is `0` where
    /// `[1, 1].lastIndexOf(1)` is `1`. A [`relative`] `from` past the end
    /// starts at the end, and one before the start finds nothing. An empty
    /// array answers before `from` is converted.
    pub(crate) fn last_index_of(
        &self,
        x: &Any<A>,
        from: Option<Any<A>>,
    ) -> Result<Option<u32>, Any<A>> {
        let len = self.length();
        if len == 0 {
            return Ok(None);
        }
        let last = f64::from(len - 1);
        let k = match from {
            Some(from) => relative(from, len)?.min(last),
            None => last,
        };
        if k < 0.0 {
            return Ok(None);
        }
        Ok((0..=k as u32).rev().find(|&i| self[i] == *x))
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
        [1.0.to_any(), 2.0.to_any(), 1.0.to_any()].to_array()
    }

    #[test]
    fn from_the_end() {
        assert_eq!(array().last_index_of(&1.0.to_any(), None), Ok(Some(2)));
        assert_eq!(array().last_index_of(&3.0.to_any(), None), Ok(None));
        assert_eq!(
            [f64::NAN.to_any()]
                .to_array::<A>()
                .last_index_of(&f64::NAN.to_any(), None),
            Ok(None)
        );
    }

    /// A passed `undefined` is `0`, not the end.
    #[test]
    fn passed_undefined_is_zero() {
        let undefined: Any<A> = Nullish::Undefined.to_any();
        assert_eq!(
            array().last_index_of(&1.0.to_any(), Some(undefined)),
            Ok(Some(0))
        );
    }

    #[test]
    fn from_a_position() {
        let at = |from: f64| array().last_index_of(&1.0.to_any(), Some(from.to_any()));
        assert_eq!(at(1.0), Ok(Some(0)));
        assert_eq!(at(9.0), Ok(Some(2)));
        assert_eq!(at(-2.0), Ok(Some(0)));
        assert_eq!(at(-4.0), Ok(None));
        assert_eq!(at(f64::NEG_INFINITY), Ok(None));
        assert_eq!(at(f64::INFINITY), Ok(Some(2)));
    }

    #[test]
    fn empty_answers_before_converting() {
        let one: Any<A> = bigint_any(1);
        assert_eq!(
            Array::<A>::default().last_index_of(&1.0.to_any(), Some(one.clone())),
            Ok(None)
        );
        assert!(array().last_index_of(&1.0.to_any(), Some(one)).is_err());
    }
}
