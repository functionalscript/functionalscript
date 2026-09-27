use super::{
    Array,
    create::create,
    relative::{clamped, relative},
};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, Nullish, ToAny},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.toSpliced(start, skip, ...items)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.tospliced>): a copy with
    /// `skip` elements from `start` removed and `items` put in their place.
    ///
    /// `start` is a [`relative`] position clamped into the array, `0` when
    /// absent. How many are removed depends on what the call passed, not
    /// only on the values: none when `start` is absent, the rest of the
    /// array when `skip` is, and otherwise `ToIntegerOrInfinity(skip)`
    /// clamped to what remains — so `toSpliced(0)` empties the array where
    /// `toSpliced(0, undefined)` removes nothing. A result past the length
    /// limit is the `RangeError` [`create`] throws.
    pub(crate) fn to_spliced(
        &self,
        start: Option<Any<A>>,
        skip: Option<Any<A>>,
        items: Array<A>,
    ) -> Result<Array<A>, Any<A>> {
        let len = self.length();
        let undefined = || Nullish::Undefined.to_any();
        let from = clamped(relative(start.clone().unwrap_or_else(undefined), len)?, len);
        let remaining = len - from;
        let skip = match (start, skip) {
            (None, _) => 0,
            (Some(_), None) => remaining,
            (Some(_), Some(skip)) => {
                clamped(skip.to_number()?.to_integer_or_infinity().into(), remaining)
            }
        };
        let new_len = u64::from(len - skip) + u64::from(items.length());
        create(
            new_len,
            (0..from)
                .map(|i| self[i].clone())
                .chain(items)
                .chain((from + skip..len).map(|i| self[i].clone())),
        )
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

    fn spliced(start: Option<Any<A>>, skip: Option<Any<A>>, items: &[f64]) -> Vec<Any<A>> {
        let a: Array<A> = [1.0.to_any(), 2.0.to_any(), 3.0.to_any()].to_array();
        let items: Array<A> = items.iter().map(|v| (*v).to_any()).to_array();
        a.to_spliced(start, skip, items)
            .unwrap()
            .into_iter()
            .collect()
    }
    fn n(v: f64) -> Option<Any<A>> {
        Some(v.to_any())
    }
    fn ns(v: &[f64]) -> Vec<Any<A>> {
        v.iter().map(|v| (*v).to_any()).collect()
    }

    #[test]
    fn what_was_passed_decides_the_count() {
        let undefined = Some(Nullish::Undefined.to_any());
        assert_eq!(spliced(None, None, &[]), ns(&[1.0, 2.0, 3.0]));
        assert_eq!(spliced(n(1.0), None, &[]), ns(&[1.0]));
        assert_eq!(spliced(n(1.0), undefined, &[]), ns(&[1.0, 2.0, 3.0]));
    }

    #[test]
    fn removes_and_inserts() {
        assert_eq!(
            spliced(n(1.0), n(1.0), &[9.0, 8.0]),
            ns(&[1.0, 9.0, 8.0, 3.0])
        );
        assert_eq!(spliced(n(-1.0), n(9.0), &[]), ns(&[1.0, 2.0]));
        assert_eq!(spliced(n(0.0), n(-1.0), &[0.0]), ns(&[0.0, 1.0, 2.0, 3.0]));
        assert_eq!(spliced(n(9.0), n(1.0), &[4.0]), ns(&[1.0, 2.0, 3.0, 4.0]));
    }
}
