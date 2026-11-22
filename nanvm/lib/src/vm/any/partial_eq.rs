use crate::common::sized_index::SizedIndex;
use crate::vm::{Any, IVm, Unpacked};

/// Same as `===` in ECMAScript.
impl<A: IVm> PartialEq for Any<A> {
    fn eq(&self, other: &Self) -> bool {
        self.with_unpacked(|a| other.with_unpacked(|b| a == b))
    }
}

impl<A: IVm> Any<A> {
    /// `SameValueZero` (<https://tc39.es/ecma262/#sec-samevaluezero>), the
    /// equality `includes` searches with: `===`, except that `NaN` equals
    /// `NaN`. `0` and `-0` stay equal, as under `===`.
    pub(crate) fn same_value_zero(&self, other: &Self) -> bool {
        self == other || (self.is_nan() && other.is_nan())
    }

    /// `SameValue` (<https://tc39.es/ecma262/#sec-samevalue>), the equality
    /// of `Object.is`: `===`, except that `NaN` equals `NaN` and `0` does
    /// not equal `-0`. Every `NaN` is the one quiet `NaN`
    /// ([`Number::NAN`](crate::vm::Number)), so equal bits are equal values.
    pub fn same_value(&self, other: &Self) -> bool {
        self.with_unpacked(|a| {
            other.with_unpacked(|b| match (a, b) {
                (Unpacked::Number(a), Unpacked::Number(b)) => {
                    f64::from(*a).to_bits() == f64::from(*b).to_bits()
                }
                _ => a == b,
            })
        })
    }

    /// Ordered structural equality over FJS values, with SameValue at leaves.
    pub fn struct_eq(&self, other: &Self) -> bool {
        use crate::vm::{Array, Property};
        use std::{iter::Zip, vec::IntoIter};

        enum Frame<A: IVm> {
            Value(Any<A>, Any<A>),
            Array(Array<A>, Array<A>, u32),
            Object(Zip<IntoIter<Property<A>>, IntoIter<Property<A>>>),
        }

        let mut pending = vec![Frame::Value(self.clone(), other.clone())];
        while let Some(frame) = pending.pop() {
            let (x, y) = match frame {
                Frame::Value(x, y) => (x, y),
                Frame::Array(a, b, i) => {
                    let pair = (a[i].clone(), b[i].clone());
                    if i + 1 < a.length() {
                        pending.push(Frame::Array(a, b, i + 1));
                    }
                    pair
                }
                Frame::Object(mut entries) => {
                    let Some(((key, x), (other_key, y))) = entries.next() else {
                        continue;
                    };
                    if key != other_key {
                        return false;
                    }
                    if entries.len() != 0 {
                        pending.push(Frame::Object(entries));
                    }
                    (x, y)
                }
            };
            if x.same_value(&y) {
                continue;
            }
            match (Unpacked::from(x), Unpacked::from(y)) {
                (Unpacked::Array(a), Unpacked::Array(b)) if a.length() == b.length() => {
                    if !a.is_empty() {
                        pending.push(Frame::Array(a, b, 0));
                    }
                }
                (Unpacked::Object(a), Unpacked::Object(b)) => {
                    let left = a.own_entries();
                    let right = b.own_entries();
                    if left.len() != right.len() {
                        return false;
                    }
                    pending.push(Frame::Object(left.into_iter().zip(right)));
                }
                _ => return false,
            }
        }
        true
    }

    /// Whether `self` is the string `s`, compared without building a VM
    /// string from `s` — a key against a built-in name.
    pub(crate) fn is_str(&self, s: &str) -> bool {
        self.with_unpacked(|v| matches!(v, Unpacked::String(k) if k.is_str(s)))
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    #[test]
    fn struct_eq_resumes_siblings() {
        let nested = |field: bool, element: bool| -> Any<A> {
            let record = [("a".into(), true.to_any()), ("b".into(), field.to_any())].to_object();
            [record.to_any(), element.to_any()].to_array().to_any()
        };
        let left = nested(true, true);
        assert!(left.struct_eq(&nested(true, true)));
        assert!(!left.struct_eq(&nested(false, true)));
        assert!(!left.struct_eq(&nested(true, false)));
    }

    #[test]
    fn struct_eq_at_depth() {
        fn nested(leaf: f64) -> Vec<Any<A>> {
            let mut levels = vec![leaf.to_any()];
            for _ in 0..10_000 {
                let array = [levels.last().unwrap().clone()].to_array().to_any();
                levels.push([("next".into(), array)].to_object().to_any());
            }
            levels
        }
        let mut left = nested(0.0);
        for leaf in [0.0, -0.0] {
            let mut right = nested(leaf);
            assert_eq!(
                left.last().unwrap().struct_eq(right.last().unwrap()),
                leaf.is_sign_positive()
            );
            // Release outer levels first to keep fixture teardown shallow too.
            while right.pop().is_some() {}
        }
        while left.pop().is_some() {}
    }

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
