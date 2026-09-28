use super::String;
use crate::vm::{Any, IVm, ToString};

/// The error for a string longer than NaNVM holds: `String<A>` is indexed
/// by `u32`, so `2³² − 1` code units. ECMAScript lets an engine refuse a
/// string shorter than its own `2⁵³ − 1` limit, and V8 refuses far shorter
/// ones, with the same `RangeError`.
const TOO_LONG: &str = "RangeError: Invalid string length";

/// A new string of `len` code units from `units`, or the `RangeError` when
/// `len` is past the limit. The length is counted in `u64` by the caller,
/// from lengths it already holds, so a result that would not fit is refused
/// before anything is built rather than wrapped or truncated.
pub(crate) fn create<A: IVm>(
    len: u64,
    units: impl IntoIterator<Item = u16>,
) -> Result<String<A>, Any<A>> {
    if len > u64::from(u32::MAX) {
        return Err(TOO_LONG.into());
    }
    Ok(units.into_iter().to_string())
}

#[cfg(test)]
mod tests {
    use super::create;
    use crate::{naive::Naive, vm::String};

    type A = Naive;

    #[test]
    fn limit() {
        let ab: Result<String<A>, _> = create(2, [0x61, 0x62]);
        assert_eq!(ab, Ok("ab".into()));
        assert!(create::<A>(u64::from(u32::MAX), []).is_ok());
        assert_eq!(
            create::<A>(u64::from(u32::MAX) + 1, []),
            Err("RangeError: Invalid string length".into())
        );
    }
}
