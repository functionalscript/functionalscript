//! A position argument, read from the `Any` a built-in is passed to the index
//! a collection can use. Arrays and strings read theirs alike, so neither owns
//! the reading.

use core::ops::Range;

use crate::vm::{Any, IVm, Nullish, Unpacked};

impl<A: IVm> Any<A> {
    /// `ToIntegerOrInfinity(ToNumber(self))`, the reading every index, count
    /// and position argument starts from. The one throw is `ToNumber`'s, a
    /// bigint's `TypeError` among them.
    pub fn to_integer_or_infinity(self) -> Result<f64, Any<A>> {
        Ok(self.to_number()?.to_integer_or_infinity().into())
    }
}

/// The position a relative index argument names in a collection of `len`
/// elements: [`Any::to_integer_or_infinity`] of the argument, counted from
/// the end when negative, as `at`, `slice`, `includes`, `indexOf`,
/// `lastIndexOf`, `toSpliced` and `with` all read one. The answer is
/// unclamped, an infinity included, so each built-in clamps or range-checks
/// it its own way; the arithmetic is on `f64`, which holds a length exactly.
pub(crate) fn relative<A: IVm>(index: Any<A>, len: u32) -> Result<f64, Any<A>> {
    let relative = index.to_integer_or_infinity()?;
    Ok(if relative >= 0.0 {
        relative
    } else {
        f64::from(len) + relative
    })
}

/// A position clamped into `[0, len]`, the range a start position of
/// `slice`, `includes`, `indexOf` and `toSpliced` is read into.
pub(crate) fn clamped(k: f64, len: u32) -> u32 {
    k.clamp(0.0, f64::from(len)) as u32
}

/// The index `k` names, when it is inside `0..len`: the element an `at`
/// reads, or the one a `with` replaces.
pub(crate) fn in_range(k: f64, len: u32) -> Option<u32> {
    (0.0..f64::from(len)).contains(&k).then_some(k as u32)
}

/// `start..end` as `slice` reads them: two [`relative`] positions clamped
/// into the collection, `start` converted first, and `end` the length when
/// `undefined`. An `end` before `start` is the empty range at `start`.
pub(crate) fn relative_range<A: IVm>(
    start: Any<A>,
    end: Any<A>,
    len: u32,
) -> Result<Range<u32>, Any<A>> {
    let from = clamped(relative(start, len)?, len);
    let to = match Unpacked::from(end.clone()) {
        Unpacked::Nullish(Nullish::Undefined) => len,
        _ => clamped(relative(end, len)?, len),
    };
    Ok(from..to.max(from))
}

#[cfg(test)]
mod tests {
    use super::{clamped, in_range, relative, relative_range};
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, ToAny, unstable::bigint_any},
    };

    type A = Naive;

    fn r(v: Any<A>) -> Result<f64, Any<A>> {
        relative(v, 3)
    }

    fn bigint_error() -> Any<A> {
        "TypeError: Cannot convert a BigInt value to a number".into()
    }

    #[test]
    fn to_integer_or_infinity() {
        assert_eq!(1.7.to_any::<A>().to_integer_or_infinity(), Ok(1.0));
        assert_eq!((-1.0f64).to_any::<A>().to_integer_or_infinity(), Ok(-1.0));
        assert_eq!(
            Nullish::Undefined.to_any::<A>().to_integer_or_infinity(),
            Ok(0.0)
        );
        let one: Any<A> = bigint_any(1);
        assert_eq!(one.to_integer_or_infinity(), Err(bigint_error()));
    }

    #[test]
    fn from_the_start_and_the_end() {
        assert_eq!(r(1.0.to_any()), Ok(1.0));
        assert_eq!(r((-1.0f64).to_any()), Ok(2.0));
        assert_eq!(r((-4.0f64).to_any()), Ok(-1.0));
        assert_eq!(r(1.7.to_any()), Ok(1.0));
        assert_eq!(r("2".into()), Ok(2.0));
        assert_eq!(r(Nullish::Undefined.to_any()), Ok(0.0));
        assert_eq!(r(f64::INFINITY.to_any()), Ok(f64::INFINITY));
        assert_eq!(r(f64::NEG_INFINITY.to_any()), Ok(f64::NEG_INFINITY));
    }

    #[test]
    fn bigint_throws() {
        assert_eq!(r(bigint_any(1)), Err(bigint_error()));
    }

    #[test]
    fn clamps_into_the_collection() {
        assert_eq!(clamped(-1.0, 3), 0);
        assert_eq!(clamped(f64::NEG_INFINITY, 3), 0);
        assert_eq!(clamped(2.0, 3), 2);
        assert_eq!(clamped(4.0, 3), 3);
        assert_eq!(clamped(f64::INFINITY, 3), 3);
    }

    #[test]
    fn inside_the_collection() {
        assert_eq!(in_range(0.0, 3), Some(0));
        assert_eq!(in_range(2.0, 3), Some(2));
        assert_eq!(in_range(3.0, 3), None);
        assert_eq!(in_range(-1.0, 3), None);
        assert_eq!(in_range(f64::INFINITY, 3), None);
        assert_eq!(in_range(f64::NEG_INFINITY, 3), None);
        assert_eq!(in_range(0.0, 0), None);
    }

    #[test]
    fn ranges() {
        let range = |start: f64, end: Any<A>| relative_range(start.to_any(), end, 3);
        assert_eq!(range(1.0, Nullish::Undefined.to_any()), Ok(1..3));
        assert_eq!(range(-2.0, (-1.0f64).to_any()), Ok(1..2));
        assert_eq!(range(-9.0, 9.0.to_any()), Ok(0..3));
        assert_eq!(range(2.0, 1.0.to_any()), Ok(2..2));
        assert_eq!(range(0.0, Nullish::Null.to_any()), Ok(0..0));
        assert_eq!(range(0.0, bigint_any(1)), Err(bigint_error()));
    }
}
