use std::collections::{BTreeMap, btree_map::Entry};

use super::Object;
use crate::{
    common::sized_index::SizedIndex,
    vm::{IVm, Property, String},
};

/// The `u32` value of `k` if ECMAScript's own-property enumeration treats it
/// as an "array index" — the keys `JSON.stringify` (via
/// `[[OwnPropertyKeys]]`) lists first, ascending, ahead of every other key
/// in insertion order: `ToString(ToUint32(key)) == key` and
/// `ToUint32(key) != 2^32 - 1`. ASCII digits only, no leading zero unless the
/// key is exactly `"0"`, and in range — `"01"` and `"4294967295"` are both
/// excluded, the first because its canonical form is `"1"`, not itself, the
/// second because it's the one `ToUint32` value the spec carves out.
///
/// [`Object::own_entries`] uses this to sort an object's array-index keys ahead
/// of the rest, by this value rather than by the key's own text — `"10"`
/// sorts after `"2"` numerically, the opposite of their lexicographic order.
fn array_index_value<A: IVm>(k: &String<A>) -> Option<u32> {
    let units: std::vec::Vec<u16> = k.clone().into_iter().collect();
    let zero = b'0' as u16;
    if units == [zero] {
        return Some(0);
    }
    if units.is_empty()
        || units[0] == zero
        || !units.iter().all(|&u| (zero..=b'9' as u16).contains(&u))
    {
        return None;
    }
    let digits: std::string::String = units.iter().map(|&u| (u as u8) as char).collect();
    digits.parse::<u32>().ok().filter(|&n| n != u32::MAX)
}

impl<A: IVm> Object<A> {
    /// The own enumerable string-keyed entries, as `[[OwnPropertyKeys]]`
    /// lists them: each key once, holding its *last* value at its *first*
    /// position, array-index keys first, ascending by value, then every
    /// other key in insertion order. The one view `JSON.stringify` writes
    /// and an object spread copies (`Any::to_json`, `Any::object_spread`),
    /// so the two cannot disagree on order.
    ///
    /// An object's property list is never deduplicated on construction
    /// ([`Object::own_property`]'s doc comment), so one pass over it keeps
    /// each key's first position and overwrites its value on every later
    /// write, finding the key's slot through a map ordered by
    /// [`String`]'s `Ord`: `O(n log n)` in the number of properties, where a
    /// scan per key would be quadratic.
    ///
    /// ```
    /// use nanvm_lib::{naive::Naive, vm::{Any, IVm, Object, String, ToAny, ToObject}};
    /// fn own_entries_test<A: IVm>() {
    ///     let o: Object<A> = [
    ///         ("b".into(), true.to_any()),
    ///         ("1".into(), true.to_any()),
    ///         ("b".into(), false.to_any()),
    ///     ].to_object();
    ///     let keys: Vec<String<A>> = o.own_entries().into_iter().map(|(k, _)| k).collect();
    ///     assert_eq!(keys, [String::from("1"), String::from("b")]);
    /// }
    /// own_entries_test::<Naive>();
    /// ```
    pub fn own_entries(&self) -> Vec<Property<A>> {
        let mut slots: BTreeMap<String<A>, usize> = BTreeMap::new();
        let mut entries: Vec<Property<A>> = Vec::new();
        for i in 0..self.length() {
            let (k, v) = &self[i];
            match slots.entry(k.clone()) {
                Entry::Occupied(slot) => entries[*slot.get()].1 = v.clone(),
                Entry::Vacant(slot) => {
                    slot.insert(entries.len());
                    entries.push((k.clone(), v.clone()));
                }
            }
        }
        let mut index_entries: Vec<(u32, Property<A>)> = Vec::new();
        let mut other_entries: Vec<Property<A>> = Vec::new();
        for (k, v) in entries {
            match array_index_value(&k) {
                Some(n) => index_entries.push((n, (k, v))),
                None => other_entries.push((k, v)),
            }
        }
        index_entries.sort_by_key(|(n, _)| *n);
        index_entries
            .into_iter()
            .map(|(_, entry)| entry)
            .chain(other_entries)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Object, String, ToAny, ToObject},
    };

    const SIZE: u32 = 100_000;

    fn key(i: u32) -> String<Naive> {
        format!("k{i}").as_str().into()
    }

    /// A size where a scan per key, quadratic, ran for seconds: one pass
    /// keeps every key, in insertion order.
    #[test]
    fn many_distinct_keys() {
        let o: Object<Naive> = (0..SIZE)
            .map(|i| (key(i), f64::from(i).to_any()))
            .to_object();
        let entries = o.own_entries();
        assert_eq!(entries.len(), SIZE as usize);
        for (i, (k, v)) in (0..SIZE).zip(entries) {
            assert_eq!(k, key(i));
            assert_eq!(v, f64::from(i).to_any());
        }
    }

    /// Every key written twice, the whole list over again: each key once,
    /// at its first position, holding the second write.
    #[test]
    fn many_repeated_keys() {
        let o: Object<Naive> = (0..2 * SIZE)
            .map(|i| (key(i % SIZE), f64::from(i).to_any()))
            .to_object();
        let entries = o.own_entries();
        assert_eq!(entries.len(), SIZE as usize);
        for (i, (k, v)) in (0..SIZE).zip(entries) {
            assert_eq!(k, key(i));
            assert_eq!(v, f64::from(SIZE + i).to_any());
        }
    }
}
