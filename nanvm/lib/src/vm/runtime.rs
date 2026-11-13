//! The runtime, `fjs/js/runtime`, as a value: `npm run gen` compiles the
//! module into `gen.runtime.rs` beside this file, through the runtime
//! printer (`fjs/compiler/rust/runtime`) and the ordinary backend, as any
//! module is compiled. [`runtime`] answers the `runtime` export object —
//! four functions: `static` and `dot` over the module's tables, `in`,
//! the body of the `in` operator, and `Boolean`, the shared `!!value` body — built
//! once by whoever runs compiled modules and handed to each as its
//! parameter: a compiled module reads a static function from it,
//! `static_read(&runtime, "Object.is")?`, which calls `static` with the id
//! ([`unstable::static_read`](crate::vm::unstable::static_read)), a
//! call step asks its `dot` for the function a member's body answers for
//! the receiver, after the receiver's own property and before the native
//! table ([`Member::call`](crate::vm::lambda::Member)), and an `in` node
//! calls its `in` with the key and the value, the naive spelling a
//! native answer may one day substitute
//! (`todo/in-native-substitution.md`). A `Boolean` node calls its `Boolean`
//! body with the operand, using the existing logical-not operations rather
//! than a separate native conversion. Every static body
//! is a closure carrying the NativeFunction text of its id, and
//! `Object.entries` is the built-in itself, so the table is complete; the
//! identity is the value's, two reads of a static one closure. No VM holds a runtime, and
//! the library asks nothing of it but through the value it is given. The
//! design: `fjs/js/runtime/README.md`, "How NaNVM finds it".

/// The compiled runtime: a `#[path]`, since a `gen.` name is not a Rust
/// identifier. Its one item, `runtime`, is re-exported from `vm`.
#[path = "gen.runtime.rs"]
pub(super) mod compiled;

use crate::vm::{Any, IVm, Object, error};

/// A compiled module: what `fjs compile` prints as
/// `pub fn module<A: IVm>(runtime: Any<A>) -> Result<Any<A>, Any<A>>`, a
/// function of the runtime value answering its export object or the value
/// its initialization threw.
pub type Module<A> = fn(Any<A>) -> Result<Any<A>, Any<A>>;

/// `module` instantiated with the runtime value: its export object, or
/// what it threw. A value that is not an object is refused with a
/// `TypeError`, since no compiled module answers one; every consumer that
/// runs a module reads its exports through this, so the refusal is said
/// once.
pub fn exports<A: IVm>(module: Module<A>) -> Result<Object<A>, Any<A>> {
    Object::try_from(module(compiled::runtime::<A>()?)?).map_err(|_| error::not_an_export_object())
}

#[cfg(test)]
mod tests {
    use super::compiled::runtime;
    use crate::vm::test::function::{returns, throws};
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, Nullish, ToAny, ToArray, ToObject, error, unstable::static_read},
    };

    type A = Naive;

    /// A module answering a fixed object, its throw, or a value that is no
    /// export object.
    fn object(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
        Ok([("a".into(), 1.0.to_any())].to_object().to_any())
    }
    fn throwing(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
        Err("boom".into())
    }
    fn number(_runtime: Any<A>) -> Result<Any<A>, Any<A>> {
        Ok(42.0.to_any())
    }

    /// The export object is the module's answer; a throw is its value, and
    /// a value that is no object is refused with one `TypeError`.
    #[test]
    fn exports() {
        use crate::vm::exports;
        let object = exports::<A>(object).unwrap();
        assert_eq!(object.own_property(&"a".into()), Some(1.0.to_any()));
        assert_eq!(exports::<A>(throwing).unwrap_err(), "boom".into());
        assert_eq!(
            exports::<A>(number).unwrap_err(),
            error::not_an_export_object()
        );
    }

    /// A property of the runtime value, by its key.
    fn at(value: &Any<A>, key: &str) -> Any<A> {
        Any::dot(value.clone(), key.into()).end().unwrap()
    }

    /// The function the runtime's `static` answers for an id.
    fn static_at(rt: &Any<A>, id: &str) -> Any<A> {
        at(rt, "static")
            .call([id.into()].to_array().to_any())
            .unwrap()
    }

    /// The generated Boolean body uses logical not twice. Containers and
    /// functions are truthy without calling their primitive-conversion hooks.
    #[test]
    fn boolean_body() {
        let rt: Any<A> = runtime::<A>().unwrap();
        let boolean = at(&rt, "Boolean");
        let boom = throws("must not convert".into());
        let hooked: Any<A> = [
            ("valueOf".into(), boom.clone()),
            ("toString".into(), boom.clone()),
        ]
        .to_object()
        .to_any();
        let cases = [
            (Any::<A>::undefined(), false),
            (Nullish::Null.to_any(), false),
            (false.to_any(), false),
            (true.to_any(), true),
            (0.0.to_any(), false),
            ((-0.0).to_any(), false),
            (f64::NAN.to_any(), false),
            (1.0.to_any(), true),
            ((-1.0).to_any(), true),
            (f64::INFINITY.to_any(), true),
            (f64::NEG_INFINITY.to_any(), true),
            ("".into(), false),
            ("false".into(), true),
            (BigInt::<A>::from(0i64).to_any(), false),
            (BigInt::<A>::from(1i64).to_any(), true),
            (BigInt::<A>::from(-1i64).to_any(), true),
            ([].to_array().to_any(), true),
            ([].to_object().to_any(), true),
            (hooked, true),
            (boom, true),
        ];
        for (value, expected) in cases {
            assert_eq!(
                boolean.clone().call([value].to_array().to_any()),
                Ok(expected.to_any())
            );
        }
        assert_eq!(boolean.call([].to_array().to_any()), Ok(false.to_any()));
    }

    /// The runtime as a value: its lookup functions over the shared tables.
    /// `static` answers a body as a function — `Object.is`, SameValue,
    /// with the NativeFunction text of its id and the `length` of its body
    /// — one value however often it is asked, as the language's own
    /// identity has it; `Object.entries` is the built-in itself, with its
    /// text; an id without a body is `undefined`; and `dot` is the
    /// dispatcher, answering an own property, a member's function of the
    /// arguments — a body keeps its own text, since no program reads a
    /// member as a value — or `undefined`.
    #[test]
    fn value() {
        let rt: Any<A> = runtime::<A>().unwrap();
        let is = static_at(&rt, "Object.is");
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
        let again = static_at(&rt, "Object.is");
        assert_eq!(is, again);
        assert!(is.same_value(&again));
        let is_nan = static_at(&rt, "Number.isNaN");
        assert_eq!(
            is_nan.clone().to_string(),
            Ok("function isNaN() { [native code] }".into())
        );
        assert_ne!(is, is_nan);
        let entries = static_at(&rt, "Object.entries");
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
        for id in ["Object.values", "Math.cbrt", "Object", "is", "toString", ""] {
            assert!(static_at(&rt, id).is_nullish(), "{id}");
        }
        let dot = at(&rt, "dot");
        let dispatch = |receiver: Any<A>, key: &str| {
            dot.clone()
                .call([receiver, key.into()].to_array().to_any())
                .unwrap()
        };
        assert!(dispatch(1.0.to_any(), "startsWith").is_nullish());
        assert!(dispatch("abc".into(), "slice").is_nullish());
        let f = returns(7.0.to_any());
        let own: Any<A> = [("startsWith".into(), f.clone())].to_object().to_any();
        assert_eq!(dispatch(own, "startsWith"), f);
        let on_abc = dispatch("abc".into(), "startsWith");
        assert_ne!(
            on_abc.clone().to_string(),
            Ok("function startsWith() { [native code] }".into())
        );
        assert_eq!(
            on_abc.call(["bc".into(), 1.0.to_any()].to_array().to_any()),
            Ok(true.to_any())
        );
    }

    /// A compiled read of a static: `static_read` asks the runtime's
    /// `static` for the id, the one closure however often it is read, and
    /// refuses an id the runtime answers no function for rather than
    /// answer `undefined` — the one refusal whatever the id names.
    #[test]
    fn static_read_by_path() {
        let rt: Any<A> = runtime::<A>().unwrap();
        let is = static_read(&rt, "Object.is").unwrap();
        assert_eq!(is, static_at(&rt, "Object.is"));
        assert_eq!(static_read(&rt, "Object.is").unwrap(), is);
        assert_eq!(
            static_read(&rt, "Object.entries").unwrap(),
            static_at(&rt, "Object.entries")
        );
        assert_eq!(
            static_read(&rt, "Object.keys").unwrap(),
            static_at(&rt, "Object.keys")
        );
        for path in ["Object.values", "Math.cbrt", "Object", "Math"] {
            assert_eq!(static_read(&rt, path), Err(error::no_static_function(path)));
        }
    }

    /// `Object.keys` is the shared runtime's function over native entries,
    /// with stable identity, standard function metadata and a fresh result.
    /// A runtime without its binding cannot supply a native fallback.
    #[test]
    fn object_keys_uses_the_common_runtime() {
        let rt: Any<A> = runtime::<A>().unwrap();
        let keys = static_read(&rt, "Object.keys").unwrap();
        assert_eq!(keys, static_read(&rt, "Object.keys").unwrap());
        assert_eq!(
            keys.clone().to_string(),
            Ok("function keys() { [native code] }".into())
        );
        assert_eq!(
            Any::dot(keys.clone(), "length".into()).end(),
            Ok(1.0.to_any())
        );
        let input = [
            ("b".into(), 1.0.to_any()),
            ("10".into(), 2.0.to_any()),
            ("2".into(), 3.0.to_any()),
            ("u".into(), Any::undefined()),
            ("__proto__".into(), 4.0.to_any()),
        ]
        .to_object()
        .to_any();
        let result = keys.clone().call([input].to_array().to_any()).unwrap();
        assert_eq!(
            result.to_json(),
            Ok(r#"["2","10","b","u","__proto__"]"#.into())
        );
        let first = keys.clone().call(["".into()].to_array().to_any()).unwrap();
        let second = keys.call(["".into()].to_array().to_any()).unwrap();
        assert_ne!(first, second);
        assert!(static_read::<A>(&Any::undefined(), "Object.keys").is_err());
        let missing: Any<A> = [("static".into(), returns(Any::undefined()))]
            .to_object()
            .to_any();
        assert_eq!(
            static_read(&missing, "Object.keys"),
            Err(error::no_static_function("Object.keys"))
        );
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
        let boom = throws("A".into());
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
