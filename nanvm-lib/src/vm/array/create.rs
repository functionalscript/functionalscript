use super::Array;
use crate::vm::{Any, IVm, ToArray};

/// The error for an array longer than JavaScript's limit, `2³² − 1`
/// elements, which is also `Array<A>`'s `u32` length limit.
const TOO_LONG: &str = "RangeError: Invalid array length";

/// A new array of `len` elements from `items`, or the `RangeError`
/// JavaScript's `ArrayCreate` throws when `len` is past the limit. The
/// length is counted in `u64` by the caller, from lengths it already holds,
/// so a result that would not fit is refused before anything is built
/// rather than wrapped or truncated.
pub(crate) fn create<A: IVm>(
    len: u64,
    items: impl IntoIterator<Item = Any<A>>,
) -> Result<Array<A>, Any<A>> {
    if len > u64::from(u32::MAX) {
        return Err(TOO_LONG.into());
    }
    Ok(items.into_iter().to_array())
}

#[cfg(test)]
mod tests {
    use super::create;
    use crate::{
        common::sized_index::SizedIndex,
        naive::Naive,
        vm::{Any, ToAny},
    };

    type A = Naive;

    #[test]
    fn within_the_limit() {
        let items: [Any<A>; 2] = [1.0.to_any(), 2.0.to_any()];
        assert_eq!(create(2, items).map(|a| a.length()), Ok(2));
    }

    #[test]
    fn past_the_limit() {
        let items: [Any<A>; 0] = [];
        assert!(create(u64::from(u32::MAX), items.clone()).is_ok());
        assert_eq!(
            create(u64::from(u32::MAX) + 1, items).map(|a| a.length()),
            Err("RangeError: Invalid array length".into())
        );
    }
}
