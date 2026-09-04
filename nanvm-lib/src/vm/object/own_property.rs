use super::Object;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, String},
};

impl<A: IVm> Object<A> {
    /// `Object.getOwnPropertyDescriptor(self, key)?.value` — a flat lookup
    /// by key, with no getter invocation and no prototype chain to walk.
    /// `nanvm-lib` objects have no `__proto__`/prototype chain at all, so
    /// this is simply what property lookup already is here — there is no
    /// second, chain-walking accessor for this to differ from. `None` is
    /// "no such own property", for the caller to turn into `undefined`.
    ///
    /// Searches from the *last* entry backward: an object's property list
    /// is never deduplicated on construction (`fjs/edag/module.f.mjs`'s own
    /// comment on `'{}'`: "duplicate keys are allowed with the later entry
    /// winning"), so the last-written entry for a repeated key is the one
    /// a lookup must answer with, not the first.
    pub(crate) fn own_property(&self, key: &String<A>) -> Option<Any<A>> {
        (0..self.length())
            .rev()
            .map(|i| &self[i])
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.clone())
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Object, String, ToAny, ToObject},
    };

    type T = Object<Naive>;

    fn key(s: &str) -> String<Naive> {
        s.into()
    }

    #[test]
    fn finds_present_property() {
        let obj: T = [(key("a"), 7.0.to_any())].to_object();
        assert_eq!(obj.own_property(&key("a")), Some(7.0.to_any()));
    }

    #[test]
    fn missing_property_is_none() {
        let obj: T = [].to_object();
        assert_eq!(obj.own_property(&key("a")), None);
    }

    #[test]
    fn distinguishes_keys() {
        let obj: T = [(key("a"), 1.0.to_any()), (key("b"), 2.0.to_any())].to_object();
        assert_eq!(obj.own_property(&key("a")), Some(1.0.to_any()));
        assert_eq!(obj.own_property(&key("b")), Some(2.0.to_any()));
        assert_eq!(obj.own_property(&key("c")), None);
    }

    #[test]
    fn empty_object_has_no_properties() {
        let obj: T = [].to_object();
        assert_eq!(obj.own_property(&key("toString")), None);
    }

    #[test]
    fn later_duplicate_key_wins() {
        // `{ a: 1, a: 2 }.a` is `2` in JS — an object's property list is
        // never deduplicated on construction, so the lookup itself has to
        // prefer the last entry rather than the first.
        let obj: T = [(key("a"), 1.0.to_any()), (key("a"), 2.0.to_any())].to_object();
        assert_eq!(obj.own_property(&key("a")), Some(2.0.to_any()));
    }
}
