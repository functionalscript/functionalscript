use super::{String, code_unit::position};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, Nullish, Unpacked, array::relative::clamped},
};

impl<A: IVm> String<A> {
    /// Whether `needle` occurs starting at code unit `k`.
    fn occurs_at(&self, needle: &String<A>, k: u32) -> bool {
        let n = needle.length();
        u64::from(k) + u64::from(n) <= u64::from(self.length())
            && (0..n).all(|i| self[k + i] == needle[i])
    }

    /// The first position at or after `from` where `needle` occurs.
    pub(crate) fn find_from(&self, needle: &String<A>, from: u32) -> Option<u32> {
        (from..=self.length()).find(|&k| self.occurs_at(needle, k))
    }

    /// `String.prototype.includes(search, pos)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.includes>): whether
    /// `ToString(search)` occurs at or after `pos`, clamped into the string.
    /// The search string converts before the position, as the algorithm
    /// orders them.
    pub(crate) fn includes(&self, search: Any<A>, pos: Any<A>) -> Result<bool, Any<A>> {
        Ok(self.index_of(search, pos)?.is_some())
    }

    /// `String.prototype.indexOf(search, pos)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.indexof>): the first
    /// position at or after `pos`, clamped, where `ToString(search)` occurs.
    /// An empty search string is found at the clamped `pos` itself.
    pub(crate) fn index_of(&self, search: Any<A>, pos: Any<A>) -> Result<Option<u32>, Any<A>> {
        let needle = search.to_string()?;
        let from = clamped(position(pos)?, self.length());
        Ok(self.find_from(&needle, from))
    }

    /// `String.prototype.lastIndexOf(search, pos)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.lastindexof>): the last
    /// position at or before `pos` where `ToString(search)` occurs. `pos` is
    /// `ToNumber`ed first and `NaN` means the end, so a passed `undefined`
    /// and no argument agree — unlike `Array`'s `lastIndexOf`.
    pub(crate) fn last_index_of(&self, search: Any<A>, pos: Any<A>) -> Result<Option<u32>, Any<A>> {
        let needle = search.to_string()?;
        let number = f64::from(pos.to_number()?);
        let pos = if number.is_nan() {
            f64::INFINITY
        } else {
            f64::from(crate::vm::Number::from(number).to_integer_or_infinity())
        };
        let len = self.length();
        let Some(last) = len.checked_sub(needle.length()) else {
            return Ok(None);
        };
        let start = clamped(pos, len).min(last);
        Ok((0..=start).rev().find(|&k| self.occurs_at(&needle, k)))
    }

    /// `String.prototype.startsWith(search, pos)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.startswith>): whether
    /// `ToString(search)` occurs at `pos`, clamped into the string.
    pub(crate) fn starts_with(&self, search: Any<A>, pos: Any<A>) -> Result<bool, Any<A>> {
        let needle = search.to_string()?;
        let k = clamped(position(pos)?, self.length());
        Ok(self.occurs_at(&needle, k))
    }

    /// `String.prototype.endsWith(search, end)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.endswith>): whether
    /// `ToString(search)` occurs ending at `end`, clamped into the string, the
    /// length when `undefined`.
    pub(crate) fn ends_with(&self, search: Any<A>, end: Any<A>) -> Result<bool, Any<A>> {
        let needle = search.to_string()?;
        let len = self.length();
        let end = match Unpacked::from(end.clone()) {
            Unpacked::Nullish(Nullish::Undefined) => len,
            _ => clamped(position(end)?, len),
        };
        Ok(end
            .checked_sub(needle.length())
            .is_some_and(|k| self.occurs_at(&needle, k)))
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, String, ToAny, unstable::bigint_any},
    };

    type A = Naive;

    fn s(v: &str) -> Any<A> {
        v.into()
    }
    fn n(v: f64) -> Any<A> {
        v.to_any()
    }
    fn undefined() -> Any<A> {
        Nullish::Undefined.to_any()
    }

    #[test]
    fn index_of() {
        let abca: String<A> = "abca".into();
        assert_eq!(abca.index_of(s("a"), undefined()), Ok(Some(0)));
        assert_eq!(abca.index_of(s("a"), n(1.0)), Ok(Some(3)));
        assert_eq!(abca.index_of(s("z"), undefined()), Ok(None));
        assert_eq!(abca.index_of(s(""), n(9.0)), Ok(Some(4)));
        assert_eq!(abca.index_of(s("abcab"), undefined()), Ok(None));
        assert_eq!(abca.includes(s("bc"), n(-5.0)), Ok(true));
    }

    #[test]
    fn last_index_of() {
        let aa: String<A> = "aa".into();
        assert_eq!(aa.last_index_of(s("a"), undefined()), Ok(Some(1)));
        assert_eq!(aa.last_index_of(s("a"), n(0.0)), Ok(Some(0)));
        assert_eq!(aa.last_index_of(s("a"), n(f64::NAN)), Ok(Some(1)));
        assert_eq!(aa.last_index_of(s("a"), n(-1.0)), Ok(Some(0)));
        assert_eq!(aa.last_index_of(s(""), undefined()), Ok(Some(2)));
        assert_eq!(aa.last_index_of(s("aaa"), undefined()), Ok(None));
    }

    #[test]
    fn starts_and_ends() {
        let abc: String<A> = "abc".into();
        assert_eq!(abc.starts_with(s("b"), n(1.0)), Ok(true));
        assert_eq!(abc.starts_with(s("abcd"), undefined()), Ok(false));
        assert_eq!(abc.ends_with(s("b"), n(2.0)), Ok(true));
        assert_eq!(abc.ends_with(s("c"), undefined()), Ok(true));
        assert_eq!(abc.ends_with(s("abc"), n(2.0)), Ok(false));
    }

    #[test]
    fn bigint_position_throws() {
        let abc: String<A> = "abc".into();
        let one: Any<A> = bigint_any(1);
        assert!(abc.index_of(s("a"), one.clone()).is_err());
        assert!(abc.last_index_of(s("a"), one).is_err());
    }
}
