use crate::vm::{Any, IVm};

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
}
