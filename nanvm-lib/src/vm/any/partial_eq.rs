use crate::vm::{Any, IVm, Unpacked};

/// Same as `===` in ECMAScript.
impl<A: IVm> PartialEq for Any<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.clone().to_unpacked() == other.0.clone().to_unpacked()
    }
}

impl<A: IVm> Any<A> {
    /// `SameValueZero` (<https://tc39.es/ecma262/#sec-samevaluezero>), the
    /// equality `includes` searches with: `===`, except that `NaN` equals
    /// `NaN`. `0` and `-0` stay equal, as under `===`.
    pub(crate) fn same_value_zero(&self, other: &Self) -> bool {
        self == other || (self.clone().is_nan() && other.clone().is_nan())
    }

    /// `SameValue` (<https://tc39.es/ecma262/#sec-samevalue>), the equality
    /// of `Object.is`: `===`, except that `NaN` equals `NaN` and `0` does
    /// not equal `-0`. Every `NaN` is the one quiet `NaN`
    /// ([`Number::NAN`](crate::vm::Number)), so equal bits are equal values.
    pub fn same_value(&self, other: &Self) -> bool {
        match (Unpacked::from(self.clone()), Unpacked::from(other.clone())) {
            (Unpacked::Number(a), Unpacked::Number(b)) => {
                f64::from(a).to_bits() == f64::from(b).to_bits()
            }
            _ => self == other,
        }
    }

    /// Whether `self` is the string `s`, compared without building a VM
    /// string from `s` — a key against a built-in name.
    pub(crate) fn is_str(&self, s: &str) -> bool {
        matches!(Unpacked::from(self.clone()), Unpacked::String(k) if k.is_str(s))
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, ToAny, ToObject},
    };

    type A = Naive;

    #[test]
    fn same_value_zero() {
        let n = |v: f64| -> Any<A> { v.to_any() };
        assert!(n(f64::NAN).same_value_zero(&n(f64::NAN)));
        assert!(n(0.0).same_value_zero(&n(-0.0)));
        assert!(n(1.0).same_value_zero(&n(1.0)));
        assert!(!n(1.0).same_value_zero(&n(2.0)));
        assert!(!n(f64::NAN).same_value_zero(&n(0.0)));
        assert!(!n(f64::NAN).same_value_zero(&"NaN".into()));
    }

    #[test]
    fn same_value() {
        let n = |v: f64| -> Any<A> { v.to_any() };
        assert!(n(f64::NAN).same_value(&n(f64::NAN)));
        assert!(!n(0.0).same_value(&n(-0.0)));
        assert!(!n(-0.0).same_value(&n(0.0)));
        assert!(n(-0.0).same_value(&n(-0.0)));
        assert!(n(1.0).same_value(&n(1.0)));
        assert!(!n(1.0).same_value(&n(2.0)));
        assert!(!n(f64::NAN).same_value(&n(0.0)));
        assert!(!n(f64::NAN).same_value(&"NaN".into()));
        // Everything else is `===`: a string by value, an object by identity.
        let s: Any<A> = "a".into();
        assert!(s.same_value(&"a".into()));
        assert!(!s.same_value(&"b".into()));
        let o: Any<A> = [].to_object().to_any();
        assert!(o.same_value(&o.clone()));
        assert!(!o.same_value(&[].to_object().to_any()));
        assert!(!n(1.0).same_value(&BigInt::<A>::from(1u64).to_any()));
    }

    #[test]
    fn is_str() {
        let s: Any<A> = "at".into();
        assert!(s.is_str("at"));
        assert!(!s.is_str("a"));
        assert!(!s.is_str("ats"));
        let n: Any<A> = 0.0.to_any();
        assert!(!n.is_str("0"));
    }
}
