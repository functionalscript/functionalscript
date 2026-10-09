use super::String;
use crate::{
    common::sized_index::SizedIndex,
    vm::{IVm, ToString, position::in_range},
};

/// A code unit that begins a surrogate pair.
pub(crate) fn is_high_surrogate(u: u16) -> bool {
    (0xD800..=0xDBFF).contains(&u)
}

/// A code unit that ends a surrogate pair.
pub(crate) fn is_low_surrogate(u: u16) -> bool {
    (0xDC00..=0xDFFF).contains(&u)
}

impl<A: IVm> String<A> {
    /// The code unit at `k`, when `k` is a position inside the string.
    pub(crate) fn unit_at(&self, k: f64) -> Option<u16> {
        in_range(k, self.length()).map(|i| self[i])
    }

    /// A string of the one code unit `u`.
    pub(crate) fn of_unit(u: u16) -> String<A> {
        [u].to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{is_high_surrogate, is_low_surrogate};
    use crate::{naive::Naive, vm::String};

    type A = Naive;

    #[test]
    fn surrogates() {
        assert!(is_high_surrogate(0xD83D));
        assert!(!is_high_surrogate(0xDE00));
        assert!(is_low_surrogate(0xDE00));
        assert!(!is_low_surrogate(0x0061));
    }

    #[test]
    fn unit_at() {
        let s: String<A> = "ab".into();
        assert_eq!(s.unit_at(1.0), Some(u16::from(b'b')));
        assert_eq!(s.unit_at(2.0), None);
        assert_eq!(s.unit_at(-1.0), None);
    }
}
