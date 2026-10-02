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
        vm::{Any, ToAny},
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
    fn is_str() {
        let s: Any<A> = "at".into();
        assert!(s.is_str("at"));
        assert!(!s.is_str("a"));
        assert!(!s.is_str("ats"));
        let n: Any<A> = 0.0.to_any();
        assert!(!n.is_str("0"));
    }
}
