use crate::vm::{Any, IVm, ObjectSpread, Unpacked};

impl<A: IVm> Any<A> {
    /// What `{...self}` copies: the source side of ECMAScript's
    /// `CopyDataProperties`
    /// (<https://tc39.es/ecma262/#sec-copydataproperties>), the own
    /// enumerable string-keyed properties of `self` in `[[OwnPropertyKeys]]`
    /// order. An object gives its entries, each key once with its last
    /// value; an array its elements keyed `"0"`, `"1"`, …; a string one
    /// entry per UTF-16 code unit; and a number, a `bigint`, a boolean, a
    /// function, `null` and `undefined` none.
    ///
    /// Never throws, unlike [`Any::get_iterator`]: `{...null}` is `{}`, where
    /// `Object.entries(null)` and object rest destructuring both throw. So
    /// an executor may evaluate an object spread whose result goes unused
    /// and lose nothing.
    pub fn object_spread(self) -> ObjectSpread<A> {
        match self.into() {
            Unpacked::Object(object) => ObjectSpread::Object(object.own_entries().into_iter()),
            Unpacked::Array(array) => ObjectSpread::Array { array, next: 0 },
            Unpacked::String(string) => ObjectSpread::String { string, next: 0 },
            _ => ObjectSpread::Empty,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{
            Any, IStaticFunction, Nullish, String, ToAny, ToArray, ToObject, ToString,
            unstable::{bigint_any, f64_any},
        },
    };

    type A = Naive;

    fn s(x: &str) -> Any<A> {
        x.into()
    }

    fn key(x: &str) -> String<A> {
        x.into()
    }

    fn units(u: &[u16]) -> Any<A> {
        let s: String<A> = u.iter().copied().to_string();
        s.to_any()
    }

    fn spread(v: Any<A>) -> Vec<(String<A>, Any<A>)> {
        v.object_spread().collect()
    }

    /// Each key once, its last value at its first position, array-index keys
    /// first by value: `{b: 1, 10: 2, 2: 3, b: 4}` spreads as
    /// `{2: 3, 10: 2, b: 4}`.
    #[test]
    fn object_entries_in_own_property_order() {
        let o: Any<A> = [
            (key("b"), s("1")),
            (key("10"), s("2")),
            (key("2"), s("3")),
            (key("b"), s("4")),
        ]
        .to_object()
        .to_any();
        assert_eq!(
            spread(o),
            [(key("2"), s("3")), (key("10"), s("2")), (key("b"), s("4"))]
        );
    }

    #[test]
    fn array_elements_by_index() {
        let a: Any<A> = [s("x"), s("y")].to_array().to_any();
        assert_eq!(spread(a), [(key("0"), s("x")), (key("1"), s("y"))]);
    }

    /// `{...'😀'}` is `{0: '\ud83d', 1: '\ude00'}`: code units, not code
    /// points, unlike `[...'😀']`.
    #[test]
    fn string_code_units() {
        assert_eq!(
            spread(s("😀")),
            [(key("0"), units(&[0xD83D])), (key("1"), units(&[0xDE00]))]
        );
        assert!(spread(s("")).is_empty());
    }

    /// `{...1}`, `{...null}` and the rest are `{}`, and nothing throws.
    #[test]
    fn no_own_properties() {
        let values: [Any<A>; 7] = [
            Nullish::Null.to_any(),
            Nullish::Undefined.to_any(),
            true.to_any(),
            f64_any(0x3ff0000000000000),
            bigint_any(1),
            [].to_object().to_any(),
            A::static_function(
                |_, _| Ok(Nullish::Undefined.to_any()),
                0,
                [].to_array(),
                None,
            )
            .to_any(),
        ];
        for v in values {
            assert!(spread(v).is_empty());
        }
    }

    #[test]
    fn exact_size_hints() {
        let mut a = [s("x"), s("y")].to_array().to_any::<A>().object_spread();
        assert_eq!(a.size_hint(), (2, Some(2)));
        a.next();
        assert_eq!(a.len(), 1);
        assert_eq!(s("😀").object_spread().len(), 2);
        let o: Any<A> = [(key("a"), s("1")), (key("a"), s("2"))]
            .to_object()
            .to_any();
        assert_eq!(o.object_spread().len(), 1);
        let mut e = Nullish::Null.to_any::<A>().object_spread();
        assert_eq!(e.size_hint(), (0, Some(0)));
        assert!(e.next().is_none());
    }
}
