use super::Object;
use crate::vm::{Any, IVm, Unpacked, string_coercion::number_to_string};

impl<A: IVm> Object<A> {
    /// `self[key]`: a `String` key is looked up as `own_property` already
    /// does — no prototype chain, last-duplicate-wins. A `Number` key is
    /// stringified first (`ToString(number)`, via the same helper
    /// `StringCoercion::number` uses), since a plain object does *not*
    /// special-case a numeric-looking key the way `Array`/`String` do:
    /// `{0:'a'}[0]` and `{0:'a'}['0']` must agree, because both spellings
    /// name the same own property, `"0"` — and every `Object<A>` can only
    /// ever *have* a `String` own property in the first place,
    /// `Property<A>` (`vm/object/property.rs`) being `(String<A>, Any<A>)`,
    /// so `"0"` is exactly the key form any real `{0:'a'}` was already
    /// built with. Every other key is `None`, for the caller
    /// (`Any::member_access`) to turn into `undefined` — unlike `own`,
    /// which instead requires a `String` key and errors on anything else:
    /// `.`/`[]`'s key is a `number | string` by the EDAG's own schema, so
    /// accepting both here is the contract, not a relaxation of `own`'s.
    pub(crate) fn member_access(&self, key: Any<A>) -> Option<Any<A>> {
        match Unpacked::from(key) {
            Unpacked::Number(n) => self.own_property(&number_to_string(n.into())),
            Unpacked::String(s) => self.own_property(&s),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Object;
    use crate::{
        naive::Naive,
        vm::{ToAny, ToObject},
    };

    type A = Naive;

    fn key(s: &str) -> crate::vm::String<A> {
        s.into()
    }

    #[test]
    fn string_key_reads_matching_property() {
        let obj: Object<A> = [(key("a"), 1.0.to_any())].to_object();
        assert_eq!(obj.member_access("a".into()), Some(1.0.to_any()));
    }

    #[test]
    fn string_key_with_no_match_is_none() {
        let obj: Object<A> = [(key("a"), 1.0.to_any())].to_object();
        assert_eq!(obj.member_access("b".into()), None);
    }

    /// `{0:'a'}[0]` and `{0:'a'}['0']` must read the same property: a
    /// plain object has no separate "array index" key space, unlike
    /// `Array`/`String`.
    #[test]
    fn numeric_key_reads_the_stringified_property() {
        let obj: Object<A> = [(key("0"), "a".into())].to_object();
        assert_eq!(obj.member_access(0.0.to_any()), Some("a".into()));
    }

    /// `-0` stringifies to `"0"`, same as everywhere else `ToString`
    /// applies to a number.
    #[test]
    fn negative_zero_key_reads_the_same_property_as_zero() {
        let obj: Object<A> = [(key("0"), "a".into())].to_object();
        assert_eq!(obj.member_access((-0.0f64).to_any()), Some("a".into()));
    }

    #[test]
    fn numeric_key_with_no_matching_property_is_none() {
        let obj: Object<A> = [(key("0"), "a".into())].to_object();
        assert_eq!(obj.member_access(1.0.to_any()), None);
    }

    /// A key that reaches `Object::member_access` as anything but a
    /// `Number` or `String` is outside the EDAG's own `index` schema
    /// (`number | string`); treated as no match rather than a panic, the
    /// same defensive default `Array`/`String::member_access` use.
    #[test]
    fn unrelated_key_type_is_none() {
        let obj: Object<A> = [(key("true"), "a".into())].to_object();
        assert_eq!(obj.member_access(true.to_any()), None);
    }
}
