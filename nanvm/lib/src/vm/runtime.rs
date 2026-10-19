//! The runtime, `fjs/js/runtime`, as a value: `npm run gen` compiles the
//! module into `gen.runtime.rs` beside this file, through the runtime
//! printer (`fjs/compiler/rust/runtime`) and the ordinary backend, as any
//! module is compiled. [`runtime`] answers the `runtime` export object —
//! `static`, `member` and `dot` — built once by whoever runs compiled
//! modules and handed to each as its parameter: a compiled module reads a
//! static function from it, `static_read(&runtime, "Object.is")?`
//! ([`unstable::static_read`](crate::vm::unstable::static_read)), and a
//! call step asks its `dot` for the function a member's body answers for
//! the receiver, after the receiver's own property and before the native
//! table
//! ([`Member::call`](crate::vm::lambda::Member)). Every built-in in it is a
//! closure carrying the NativeFunction text of its path, and `Object.entries`
//! is the built-in itself, so the value is complete; the identity is the
//! value's, two reads of a static one closure. No VM holds a runtime, and
//! the library asks nothing of it but through the value it is given. The
//! design: `fjs/js/runtime/README.md`, "How NaNVM finds it".

/// The compiled runtime: a `#[path]`, since a `gen.` name is not a Rust
/// identifier. Its one item, `runtime`, is re-exported from `vm`.
#[path = "gen.runtime.rs"]
pub(super) mod compiled;

#[cfg(test)]
mod tests {
    use super::compiled::runtime;
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, IVm, ToAny, ToArray, ToObject, error, unstable::static_read},
    };

    type A = Naive;

    /// A property of the runtime value, by its key: `static`, `Object`, `is`.
    fn at(value: &Any<A>, key: &str) -> Any<A> {
        Any::dot(value.clone(), key.into()).end().unwrap()
    }

    /// The runtime as a value: the export object with its three sections.
    /// A static read from it is the body as a function — `Object.is`,
    /// SameValue, with the NativeFunction text of its path and the
    /// `length` of its body — one value however often it is read, as the
    /// language's own identity has it; `Object.entries` is the built-in
    /// itself, with its text; a member read from it is the body of the
    /// receiver; and `dot` is the dispatcher, answering an own property, a
    /// member's function of the arguments, or `undefined`.
    #[test]
    fn value() {
        let rt: Any<A> = runtime::<A>().unwrap();
        let statics = at(&rt, "static");
        let is = at(&at(&statics, "Object"), "is");
        assert_eq!(
            is.clone().to_string(),
            Ok("function is() { [native code] }".into())
        );
        assert_eq!(
            Any::dot(is.clone(), "length".into()).end(),
            Ok(2.0.to_any())
        );
        let call = |a: Any<A>, b: Any<A>| is.clone().call([a, b].to_array().to_any());
        assert_eq!(call((-0.0).to_any(), 0.0.to_any()), Ok(false.to_any()));
        assert_eq!(
            call(f64::NAN.to_any(), f64::NAN.to_any()),
            Ok(true.to_any())
        );
        assert_eq!(call("a".into(), "a".into()), Ok(true.to_any()));
        let again = at(&at(&at(&rt, "static"), "Object"), "is");
        assert_eq!(is, again);
        assert!(is.same_value(&again));
        let is_nan = at(&at(&statics, "Number"), "isNaN");
        assert_eq!(
            is_nan.clone().to_string(),
            Ok("function isNaN() { [native code] }".into())
        );
        assert_ne!(is, is_nan);
        let entries = at(&at(&statics, "Object"), "entries");
        assert_eq!(
            entries.clone().to_string(),
            Ok("function entries() { [native code] }".into())
        );
        assert_eq!(
            Any::dot(entries.clone(), "length".into()).end(),
            Ok(1.0.to_any())
        );
        let pairs = entries
            .clone()
            .call(["ab".into()].to_array().to_any())
            .unwrap();
        assert_eq!(pairs.to_json(), Ok(r#"[["0","a"],["1","b"]]"#.into()));
        assert!(entries.call([].to_array().to_any()).is_err());
        let starts_with = at(&at(&rt, "member"), "startsWith");
        assert_eq!(
            starts_with.clone().to_string(),
            Ok("function startsWith() { [native code] }".into())
        );
        let on_abc = starts_with
            .call(["abc".into()].to_array().to_any())
            .unwrap();
        assert_eq!(
            on_abc.call(["ab".into()].to_array().to_any()),
            Ok(true.to_any())
        );
        let dot = at(&rt, "dot");
        let dispatch = |receiver: Any<A>, key: &str| {
            dot.clone()
                .call([receiver, key.into()].to_array().to_any())
                .unwrap()
        };
        assert!(dispatch(1.0.to_any(), "startsWith").is_nullish());
        assert!(dispatch("abc".into(), "slice").is_nullish());
        let f = A::static_function(|_, _| Ok(7.0.to_any()), 0, [].to_array(), None).to_any();
        let own: Any<A> = [("startsWith".into(), f.clone())].to_object().to_any();
        assert_eq!(dispatch(own, "startsWith"), f);
        assert_eq!(
            dispatch("abc".into(), "startsWith")
                .call(["bc".into(), 1.0.to_any()].to_array().to_any()),
            Ok(true.to_any())
        );
    }

    /// A compiled read of a static: `static_read` walks the path into the
    /// `static` section, the one closure however often it is read, and
    /// refuses a path the value lacks rather than answer `undefined` — the
    /// one refusal whether the function, its namespace or a namespace on
    /// the way is what is missing, never the `TypeError` of reading a key
    /// of a missing namespace.
    #[test]
    fn static_read_by_path() {
        let rt: Any<A> = runtime::<A>().unwrap();
        let is = static_read(&rt, "Object.is").unwrap();
        assert_eq!(is, at(&at(&at(&rt, "static"), "Object"), "is"));
        assert_eq!(static_read(&rt, "Object.is").unwrap(), is);
        assert_eq!(
            static_read(&rt, "Object.entries").unwrap(),
            at(&at(&at(&rt, "static"), "Object"), "entries")
        );
        for path in ["Object.keys", "Math.max", "Object", "Math"] {
            assert_eq!(static_read(&rt, path), Err(error::no_static_function(path)));
        }
    }

    /// A call step reaches a body through the value: `"abc".startsWith`
    /// through `dot`, before the native table, the receiver alone first and
    /// then the arguments, and `?.()` sees the body's function as a callee
    /// on a string and nothing on a number. The search is converted before
    /// the position, as the body orders them: its own `toString`'s throw
    /// wins over the bigint position's `TypeError`.
    #[test]
    fn member_call_through_the_value() {
        let rt: Any<A> = runtime::<A>().unwrap();
        let key: Any<A> = "startsWith".into();
        assert_eq!(
            1.0.to_any::<A>()
                .dot(key.clone())
                .option_call(&rt, || panic!("the arguments of a skipped call"))
                .end(),
            Ok(Any::undefined())
        );
        let abc: Any<A> = "abc".into();
        let args = || Ok(["ab".into()].to_array().to_any());
        assert_eq!(
            abc.clone().dot(key.clone()).end_call(&rt, args),
            Ok(true.to_any())
        );
        assert_eq!(
            abc.clone().dot(key.clone()).option_call(&rt, args).end(),
            Ok(true.to_any())
        );
        assert_eq!(
            abc.clone()
                .dot(key.clone())
                .end_call(&rt, || Ok(["bc".into(), 1.0.to_any()].to_array().to_any())),
            Ok(true.to_any())
        );
        assert!(
            abc.clone()
                .dot(key.clone())
                .end_call(&rt, || Ok(["a".into(), BigInt::<A>::from(0i64).to_any()]
                    .to_array()
                    .to_any()))
                .is_err()
        );
        let boom = A::static_function(|_, _| Err("A".into()), 0, [].to_array(), None).to_any();
        let search: Any<A> = [("toString".into(), boom)].to_object().to_any();
        assert_eq!(
            abc.dot(key)
                .end_call(&rt, || Ok([search, BigInt::<A>::from(0i64).to_any()]
                    .to_array()
                    .to_any())),
            Err("A".into())
        );
    }
}
