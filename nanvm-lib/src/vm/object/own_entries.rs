use super::Object;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, String},
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
    /// ([`Object::own_property`]'s doc comment), so the distinct keys are
    /// collected first, in first-seen order, and each one's value is then
    /// the last write, as `own_property` reads it.
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
    pub fn own_entries(&self) -> Vec<(String<A>, Any<A>)> {
        let mut keys: Vec<String<A>> = Vec::new();
        for i in 0..self.length() {
            let (k, _) = &self[i];
            if !keys.iter().any(|seen| seen == k) {
                keys.push(k.clone());
            }
        }
        let mut index_keys: Vec<(u32, String<A>)> = Vec::new();
        let mut other_keys: Vec<String<A>> = Vec::new();
        for k in keys {
            match array_index_value(&k) {
                Some(n) => index_keys.push((n, k)),
                None => other_keys.push(k),
            }
        }
        index_keys.sort_by_key(|(n, _)| *n);
        index_keys
            .into_iter()
            .map(|(_, k)| k)
            .chain(other_keys)
            .map(|k| {
                let value = self
                    .own_property(&k)
                    .expect("key was just read from this object's own properties");
                (k, value)
            })
            .collect()
    }
}
