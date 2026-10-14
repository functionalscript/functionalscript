use super::String;
use crate::vm::{
    Any, IVm, ToAny,
    member_access::{indexed_entry, indexed_member_access},
};

impl<A: IVm> String<A> {
    /// `self[key]` by the indexed-receiver rule
    /// (`vm/member_access.rs`'s `indexed_member_access`): an index reads
    /// the single UTF-16 code unit at that position, as a one-character
    /// `String<A>` (matches JS `str[i]`, *not* `.charAt`, which is a
    /// prototype method and out of scope, same as every other built-in
    /// method), and `"length"` reads the UTF-16 length.
    pub(crate) fn member_access(&self, key: Any<A>) -> Option<Any<A>> {
        indexed_member_access(self, key, unit)
    }

    /// The code unit a canonical index string names, as a one-unit
    /// `String<A>` (`vm/member_access.rs`'s `indexed_entry`): what the
    /// `entry` helper (`Any::entry`) reads of a string.
    pub(crate) fn entry(&self, key: &String<A>) -> Option<Any<A>> {
        indexed_entry(self, key, unit)
    }
}

/// The code unit at the in-bounds index `i`, as a one-unit string.
fn unit<A: IVm>(s: &String<A>, i: u32) -> Any<A> {
    String::of_unit(s[i]).to_any()
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

    /// An index, as a number or as its canonical string, as a member or as
    /// an entry, reads the code unit there as a one-unit string. Which keys
    /// are indices is `vm/member_access.rs`'s rule, tested there.
    #[test]
    fn index_reads_code_unit() {
        let s = string("ab");
        assert_eq!(s.member_access(1.0.to_any()), Some(string("b").to_any()));
        assert_eq!(s.member_access("1".into()), Some(string("b").to_any()));
        assert_eq!(s.entry(&"1".into()), Some(string("b").to_any()));
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
