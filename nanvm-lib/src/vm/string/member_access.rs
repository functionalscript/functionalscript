use super::String;
use crate::{
    common::sized_index::SizedIndex,
    vm::{
        Any, IVm, Number, ToAny, ToString, Unpacked,
        member_access::{canonical_index, string_to_index},
    },
};

impl<A: IVm> String<A> {
    /// `self[key]`: an in-bounds index — given as a `Number` or its
    /// canonical decimal string — reads the single UTF-16 code unit at
    /// that position, as a one-character `String<A>` (matches JS `str[i]`,
    /// *not* `.charAt`, which is a prototype method and out of scope, same
    /// as every other built-in method); the string key `"length"` reads
    /// the UTF-16 length; every other key is `None`, for
    /// the caller (`Any::member_access`) to turn into `undefined` — the
    /// same contract `Array::member_access` and `Object::own_property`
    /// have.
    ///
    /// Never panics on an out-of-range index: `index < len` is checked
    /// before indexing, so `String`'s own `Index<u32>` (which still panics
    /// out of bounds, by ordinary Rust convention — see
    /// `vm/string/index.rs`) is never reached with a bad index.
    ///
    /// `.length` is reachable only through the string key `"length"` —
    /// never through a number, the way JS itself never lets
    /// `string[string.length]` collide with `string["length"]`.
    pub(crate) fn member_access(&self, key: Any<A>) -> Option<Any<A>> {
        let len = self.length();
        match Unpacked::from(key) {
            Unpacked::Number(n) => canonical_index(n)
                .filter(|&i| i < len)
                .map(|i| [self[i]].to_string::<A>().to_any()),
            Unpacked::String(s) => {
                if s == "length".into() {
                    Some(Number::from(len).to_any())
                } else {
                    string_to_index(&s)
                        .filter(|&i| i < len)
                        .map(|i| [self[i]].to_string::<A>().to_any())
                }
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::String;
    use crate::{
        naive::Naive,
        vm::{ToAny, ToString},
    };

    type A = Naive;

    fn string(s: &str) -> String<A> {
        s.into()
    }

    #[test]
    fn numeric_index_reads_code_unit() {
        let s = string("abc");
        assert_eq!(s.member_access(0.0.to_any()), Some(string("a").to_any()));
        assert_eq!(s.member_access(2.0.to_any()), Some(string("c").to_any()));
    }

    /// A numeric `-0` key stringifies to `"0"` before it is ever used as a
    /// key, in real JS as here, so it reads the same unit `0` does —
    /// unlike the *string* key `"-0"`, which `non_canonical_string_index_is_none`
    /// below covers (shared with `Array::member_access` — see
    /// `vm/member_access.rs`).
    #[test]
    fn negative_zero_index_reads_first_unit() {
        let s = string("a");
        assert_eq!(
            s.member_access((-0.0f64).to_any()),
            Some(string("a").to_any())
        );
    }

    #[test]
    fn out_of_range_numeric_index_is_none() {
        let s = string("a");
        assert_eq!(s.member_access(1.0.to_any()), None);
    }

    #[test]
    fn non_integer_or_negative_numeric_index_is_none() {
        let s = string("a");
        assert_eq!(s.member_access(0.5.to_any()), None);
        assert_eq!(s.member_access((-1.0f64).to_any()), None);
    }

    #[test]
    fn canonical_string_index_reads_code_unit() {
        let s = string("ab");
        assert_eq!(s.member_access("0".into()), Some(string("a").to_any()));
        assert_eq!(s.member_access("1".into()), Some(string("b").to_any()));
    }

    #[test]
    fn non_canonical_string_index_is_none() {
        let s = string("a");
        for key in ["01", "+0", "1.0", " 0", "-0", ""] {
            assert_eq!(
                s.member_access(key.into()),
                None,
                "key {key:?} must not read a code unit"
            );
        }
    }

    #[test]
    fn length_key_reads_length() {
        let s = string("abc");
        assert_eq!(s.member_access("length".into()), Some(3.0.to_any()));
    }

    /// `.length` is looked up only through the string key `"length"`; the
    /// number `3` on a 3-unit string is a plain out-of-range index, not a
    /// second spelling of `.length`.
    #[test]
    fn length_is_not_reachable_by_number() {
        let s = string("abc");
        assert_eq!(s.member_access(3.0.to_any()), None);
    }

    #[test]
    fn unrelated_key_is_none() {
        let s = string("a");
        assert_eq!(s.member_access(true.to_any()), None);
    }

    /// A lone unpaired surrogate is a legal (if unpaired) UTF-16 code unit
    /// — `String<A>` stores it without validating, indexing included, so
    /// `member_access` must hand it back as-is rather than replace it with
    /// U+FFFD or reject it.
    #[test]
    fn unpaired_surrogate_index_is_read_verbatim() {
        let lone_high_surrogate = 0xD800u16;
        let s: String<A> = [lone_high_surrogate].to_string();
        assert_eq!(
            s.member_access(0.0.to_any()),
            Some([lone_high_surrogate].to_string::<A>().to_any())
        );
    }
}
