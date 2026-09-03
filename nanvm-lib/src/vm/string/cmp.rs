use core::cmp::Ordering;

use crate::{
    common::sized_index::SizedIndex,
    vm::{IVm, String},
};

/// Lexicographic order by UTF-16 code unit — `String::lessThan`, the rule
/// `<` uses when both operands are strings. Not codepoint-aware: a
/// surrogate pair is compared unit by unit, the same as any other pair of
/// code units, never combined into one codepoint first.
impl<A: IVm> PartialOrd for String<A> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl<A: IVm> Eq for String<A> {}

impl<A: IVm> Ord for String<A> {
    fn cmp(&self, other: &Self) -> Ordering {
        let mut a = self.clone().index_iter();
        let mut b = other.clone().index_iter();
        loop {
            return match (a.next(), b.next()) {
                (Some(x), Some(y)) => match x.cmp(&y) {
                    Ordering::Equal => continue,
                    order => order,
                },
                (Some(_), None) => Ordering::Greater,
                (None, Some(_)) => Ordering::Less,
                (None, None) => Ordering::Equal,
            };
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::naive::Naive;

    type T = super::String<Naive>;

    fn s(v: &str) -> T {
        v.into()
    }

    #[test]
    fn equal_strings() {
        assert_eq!(s("abc").cmp(&s("abc")), core::cmp::Ordering::Equal);
    }

    #[test]
    fn shorter_prefix_is_less() {
        assert!(s("ab") < s("abc"));
        assert!(s("abc") > s("ab"));
    }

    #[test]
    fn first_differing_unit_decides() {
        assert!(s("10") < s("9"));
        assert!(s("a") < s("b"));
        assert!(s("B") < s("a"));
    }

    #[test]
    fn empty_string_is_least() {
        assert!(s("") < s("a"));
    }
}
