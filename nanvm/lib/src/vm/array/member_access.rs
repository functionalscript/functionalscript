use super::Array;
use crate::vm::{
    Any, IVm, String,
    member_access::{indexed_entry, indexed_member_access},
};

impl<A: IVm> Array<A> {
    /// `self[key]` by the indexed-receiver rule
    /// (`vm/member_access.rs`'s `indexed_member_access`): an index reads
    /// the element.
    pub(crate) fn member_access(&self, key: Any<A>) -> Option<Any<A>> {
        indexed_member_access(self, key, element)
    }

    /// The element a canonical index string names
    /// (`vm/member_access.rs`'s `indexed_entry`): what the `entry` helper
    /// (`Any::entry`) reads of an array.
    pub(crate) fn entry(&self, key: &String<A>) -> Option<Any<A>> {
        indexed_entry(self, key, element)
    }
}

/// The element at the in-bounds index `i`.
fn element<A: IVm>(array: &Array<A>, i: u32) -> Any<A> {
    array[i].clone()
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{ToAny, ToArray},
    };

    type A = Naive;

    /// An index, as a number or as its canonical string, as a member or as
    /// an entry, reads the element itself. Which keys are indices is
    /// `vm/member_access.rs`'s rule, tested there.
    #[test]
    fn index_reads_element() {
        let a: Array<A> = [10.0.to_any(), 20.0.to_any()].to_array();
        assert_eq!(a.member_access(1.0.to_any()), Some(20.0.to_any()));
        assert_eq!(a.member_access("1".into()), Some(20.0.to_any()));
        assert_eq!(a.entry(&"1".into()), Some(20.0.to_any()));
    }
}
