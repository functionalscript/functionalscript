use super::Function;
use crate::vm::{Any, IVm, Number, ToAny, Unpacked};

impl<A: IVm> Function<A> {
    /// `self[key]`: the string key `"length"` reads the declared arity —
    /// `f.length`, the one property a function has — and every other key
    /// is `None`, for the caller (`Any::member_access`) to turn into
    /// `undefined`, the same contract `Array::member_access` has.
    pub(crate) fn member_access(&self, key: Any<A>) -> Option<Any<A>> {
        match Unpacked::from(key) {
            Unpacked::String(s) if s == "length".into() => {
                Some(Number::from(self.length()).to_any())
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Function, IStaticFunction, Nullish, ToAny, ToArray},
    };

    type A = Naive;

    fn function(length: u32) -> Function<A> {
        A::static_function(
            |_, _| Ok(Nullish::Undefined.to_any()),
            length,
            [].to_array(),
        )
    }

    #[test]
    fn length_is_the_declared_arity() {
        assert_eq!(
            function(2).member_access("length".into()),
            Some(2.0.to_any())
        );
        assert_eq!(
            function(0).member_access("length".into()),
            Some(0.0.to_any())
        );
    }

    #[test]
    fn every_other_key_is_none() {
        let f = function(2);
        assert_eq!(f.member_access("a".into()), None);
        assert_eq!(f.member_access(0.0.to_any()), None);
        let key: Any<A> = Nullish::Undefined.to_any();
        assert_eq!(f.member_access(key), None);
    }
}
