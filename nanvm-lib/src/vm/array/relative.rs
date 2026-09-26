use crate::vm::{Any, IVm};

/// The position a relative index argument names in an array of `len`
/// elements: `ToIntegerOrInfinity` of the argument converted by `ToNumber`,
/// counted from the end when negative, as `at`, `slice`, `includes`,
/// `indexOf`, `lastIndexOf`, `toSpliced` and `with` all read one. The answer
/// is unclamped, an infinity included, so each built-in clamps or
/// range-checks it its own way; the arithmetic is on `f64`, which holds a
/// length exactly. The one throw is `ToNumber`'s, a bigint's `TypeError`.
pub(crate) fn relative<A: IVm>(index: Any<A>, len: u32) -> Result<f64, Any<A>> {
    let relative = f64::from(index.to_number()?.to_integer_or_infinity());
    Ok(if relative >= 0.0 {
        relative
    } else {
        f64::from(len) + relative
    })
}

/// A relative position clamped into `[0, len]`, the range a start position
/// of `slice`, `includes`, `indexOf` and `toSpliced` is read into.
pub(crate) fn clamped(k: f64, len: u32) -> u32 {
    k.clamp(0.0, f64::from(len)) as u32
}

#[cfg(test)]
mod tests {
    use super::{clamped, relative};
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, ToAny, unstable::bigint_any},
    };

    type A = Naive;

    fn r(v: Any<A>) -> Result<f64, Any<A>> {
        relative(v, 3)
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
        let one: Any<A> = bigint_any(1);
        assert_eq!(
            r(one),
            Err("TypeError: Cannot convert a BigInt value to a number".into())
        );
    }

    #[test]
    fn clamps_into_the_array() {
        assert_eq!(clamped(-1.0, 3), 0);
        assert_eq!(clamped(f64::NEG_INFINITY, 3), 0);
        assert_eq!(clamped(2.0, 3), 2);
        assert_eq!(clamped(4.0, 3), 3);
        assert_eq!(clamped(f64::INFINITY, 3), 3);
    }
}
