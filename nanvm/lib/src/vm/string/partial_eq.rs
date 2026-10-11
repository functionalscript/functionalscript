use crate::vm::{IContainer, IVm, String};

impl<A: IVm> PartialEq for String<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.items_eq(&other.0)
    }
}

impl<A: IVm> String<A> {
    /// Whether `self` is `s`, code unit by code unit against its UTF-16
    /// encoding, without building a VM string from the literal — the
    /// question every built-in name lookup asks.
    ///
    /// An inherent method, not `PartialEq<str>`: a second `PartialEq`
    /// impl would leave every `s == "x".into()` in the crate without a
    /// target type for `into`.
    pub(crate) fn is_str(&self, s: &str) -> bool {
        self.clone().into_iter().eq(s.encode_utf16())
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{String, ToString},
    };

    type A = Naive;

    #[test]
    fn is_str() {
        let s: String<A> = "length".into();
        assert!(s.is_str("length"));
        assert!(!s.is_str("lengt"));
        assert!(!s.is_str("lengths"));
        assert!(!s.is_str(""));
        let empty: String<A> = "".into();
        assert!(empty.is_str(""));
        assert!(!empty.is_str("a"));
    }

    /// The literal is compared as UTF-16, as the VM string holds it: a
    /// character outside the BMP is its surrogate pair, and a lone
    /// surrogate, which no `&str` spells, equals nothing.
    #[test]
    fn is_str_utf16() {
        let pair: String<A> = "😀".into();
        assert!(pair.is_str("😀"));
        let lone: String<A> = [0xD83D].to_string();
        assert!(!lone.is_str("😀"));
        assert!(!lone.is_str("\u{FFFD}"));
    }
}
