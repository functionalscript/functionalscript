use super::String;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, ToString},
};

/// A code unit that begins a surrogate pair.
pub(crate) fn is_high_surrogate(u: u16) -> bool {
    (0xD800..=0xDBFF).contains(&u)
}

/// A code unit that ends a surrogate pair.
pub(crate) fn is_low_surrogate(u: u16) -> bool {
    (0xDC00..=0xDFFF).contains(&u)
}

/// A position read as `charAt`, `charCodeAt` and `codePointAt` read one:
/// `ToIntegerOrInfinity` of the argument converted by `ToNumber`, never
/// counted from the end, a bigint's throw included.
pub(crate) fn position<A: IVm>(pos: Any<A>) -> Result<f64, Any<A>> {
    Ok(f64::from(pos.to_number()?.to_integer_or_infinity()))
}

impl<A: IVm> String<A> {
    /// The code unit at `k`, when `k` is a position inside the string.
    pub(crate) fn unit_at(&self, k: f64) -> Option<u16> {
        (0.0..f64::from(self.length()))
            .contains(&k)
            .then(|| self[k as u32])
    }

    /// A string of the one code unit `u`.
    pub(crate) fn of_unit(u: u16) -> String<A> {
        [u].to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{is_high_surrogate, is_low_surrogate, position};
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, String, ToAny, unstable::bigint_any},
    };

    type A = Naive;

    #[test]
    fn surrogates() {
        assert!(is_high_surrogate(0xD83D));
        assert!(!is_high_surrogate(0xDE00));
        assert!(is_low_surrogate(0xDE00));
        assert!(!is_low_surrogate(0x0061));
    }

    #[test]
    fn positions() {
        assert_eq!(position::<A>(1.7.to_any()), Ok(1.0));
        assert_eq!(position::<A>((-1.0f64).to_any()), Ok(-1.0));
        assert_eq!(position::<A>(Nullish::Undefined.to_any()), Ok(0.0));
        let one: Any<A> = bigint_any(1);
        assert!(position(one).is_err());
        let s: String<A> = "ab".into();
        assert_eq!(s.unit_at(1.0), Some(u16::from(b'b')));
        assert_eq!(s.unit_at(2.0), None);
        assert_eq!(s.unit_at(-1.0), None);
    }
}
