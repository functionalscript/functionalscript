//! The runtime, `fjs/js/runtime`, bound: the static runtime `npm run gen`
//! compiles from it into `gen.runtime.rs` beside this file, through the
//! compiler's static-runtime printer (`fjs/compiler/rust/runtime`). Every
//! body is a static function: a static built-in's with an accessor
//! answering its [`RuntimeFunction`], since a read of one is a value, a
//! member's the code alone, of the receiver, answering `undefined` for a
//! receiver the name is no member of or the function of the arguments, a
//! closure over the receiver, since nothing reads a member as a value and a
//! call step asks it in those two steps. The runtime's `dot`, the
//! dispatcher, is compiled by its shape: the receiver's own enumerable
//! property, else the member the key names called on the receiver — a
//! `match` on the name over the member bodies — else `undefined`, which
//! is what a call step calls ([`runtime_dot`]). One table, `statics` by
//! name, is what [`runtime_static`] searches. No VM holds a runtime, and
//! nothing is evaluated: a built-in is one function by its name however
//! often it is read, for every VM. The native tables in `vm/lambda` keep
//! every name without a body, and may keep a name that has one where a
//! measurement justifies the second implementation. [`object_entries`] is
//! the one static function no body can define, written here and listed
//! in the compiled table beside the bodies. The design:
//! `fjs/js/runtime/README.md`, "How NaNVM finds it".

use crate::vm::{Any, Array, IVm, RuntimeFunction};

/// The compiled runtime: a `#[path]`, since a `gen.` name is not a Rust
/// identifier. Its accessors are every compiled module's, re-exported from
/// `vm`; its tables are this module's to search.
#[path = "gen.runtime.rs"]
pub(super) mod compiled;

/// The static function `name` names, JavaScript's own spelling of it,
/// `Object.is`: a body of the runtime's `static` section, or a native
/// written here, `Object.entries`; `None` for a name the runtime lacks.
pub fn runtime_static<A: IVm>(name: &str) -> Option<&'static RuntimeFunction<A>> {
    compiled::statics::<A>()
        .into_iter()
        .find(|(n, _)| *n == name)
        .map(|(_, accessor)| accessor())
}

/// The runtime's `dot`, compiled: what a call step calls for the receiver
/// under the key — the receiver's own enumerable property, whatever it
/// holds, so an own property shadows a member as in JavaScript; else the
/// function of the arguments the member body of the name answers for the
/// receiver, a closure over it, or `undefined` where the name is no member
/// of the receiver's type or has no body; the body's throw where its first
/// step throws. The one resolution, written once in `fjs/js/runtime` and
/// asked by [`Member`](crate::vm::lambda) in `vm/lambda/member.rs` before
/// its native table, and by the guard of `?.()` before any argument
/// exists; a body is pure, so asking twice costs and changes nothing. The
/// receiver is not nullish: the call step threw for one before.
pub fn runtime_dot<A: IVm>(receiver: Any<A>, key: Any<A>) -> Result<Any<A>, Any<A>> {
    compiled::dot(receiver, key)
}

/// The code of `Object.entries`: the entries of its first argument,
/// [`Any::entries`].
fn entries_code<A: IVm>(args: Array<A>) -> Result<Any<A>, Any<A>> {
    args.into_iter()
        .next()
        .unwrap_or_else(Any::undefined)
        .entries()
}

/// `Object.entries`, the one static function no body can define,
/// enumerating keys being what the language has no other way to do
/// ([`Any::entries`]): a built-in written here, where every other static
/// is a body of the runtime's `static` section (`fjs/js/static`'s
/// `natives`), and listed in the compiled `statics` table beside them. The
/// descriptor is a promoted constant: nothing is allocated, and every read
/// answers a handle to one function, equal to every other by its name.
pub fn object_entries<A: IVm>() -> &'static RuntimeFunction<A> {
    &RuntimeFunction {
        name: "Object.entries",
        code: entries_code::<A>,
        length: 1,
    }
}

#[cfg(test)]
mod tests {
    use super::{compiled::object_is, object_entries, runtime_dot, runtime_static};
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, Function, IVm, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    /// `dot` on a string: a body is found by its name; a name without a
    /// body, an unknown name, the name spelled otherwise and an index past
    /// the end answer `undefined`, where an index within it is the
    /// character, the string's own.
    #[test]
    fn lookup() {
        let dot = |key: Any<A>| runtime_dot("abc".into(), key).unwrap();
        assert!(!dot("startsWith".into()).is_nullish());
        assert!(dot("slice".into()).is_nullish());
        assert!(dot("nothing".into()).is_nullish());
        assert!(dot("startswith".into()).is_nullish());
        assert!(dot(9.0.to_any()).is_nullish());
        assert_eq!(dot(1.0.to_any()), "b".into());
    }

    /// `dot` on a receiver that owns the key: the own enumerable property
    /// wins, whatever it holds — a function, a number under a member's
    /// name, `undefined` — and an own property no entry sees, a `length`,
    /// is `undefined` as a name without a body is.
    #[test]
    fn own_property() {
        let seven = A::static_function(|_, _| Ok(7.0.to_any()), 0, [].to_array(), None).to_any();
        let o: Any<A> = [
            ("f".into(), seven.clone()),
            ("startsWith".into(), 1.0.to_any()),
            ("u".into(), Any::undefined()),
        ]
        .to_object()
        .to_any();
        assert_eq!(runtime_dot(o.clone(), "f".into()), Ok(seven));
        assert_eq!(
            runtime_dot(o.clone(), "startsWith".into()),
            Ok(1.0.to_any())
        );
        assert_eq!(runtime_dot(o.clone(), "u".into()), Ok(Any::undefined()));
        assert_eq!(runtime_dot(o, "x".into()), Ok(Any::undefined()));
        let a: Any<A> = [8.0.to_any()].to_array().to_any();
        assert_eq!(runtime_dot(a.clone(), 0.0.to_any()), Ok(8.0.to_any()));
        assert_eq!(runtime_dot(a, "length".into()), Ok(Any::undefined()));
    }

    /// A static body is found by its name, and is the one its accessor
    /// answers; a name the section lacks, a namespace that is no function
    /// and a name past a function are not. The body found is the compiled
    /// `Object.is`, SameValue, whose text is the NativeFunction text of its
    /// name, never its body's.
    #[test]
    fn static_lookup() {
        let is: Any<A> = Function::from(runtime_static::<A>("Object.is").unwrap()).to_any();
        assert_eq!(is, Function::from(object_is::<A>()).to_any());
        assert_eq!(
            is.clone().to_string(),
            Ok("function is() { [native code] }".into())
        );
        let call = |a: Any<A>, b: Any<A>| is.clone().call([a, b].to_array().to_any());
        assert_eq!(call((-0.0).to_any(), 0.0.to_any()), Ok(false.to_any()));
        assert_eq!(
            call(f64::NAN.to_any(), f64::NAN.to_any()),
            Ok(true.to_any())
        );
        assert_eq!(call("a".into(), "a".into()), Ok(true.to_any()));
        assert!(runtime_static::<A>("Object").is_none());
        assert!(runtime_static::<A>("Object.keys").is_none());
        assert!(runtime_static::<A>("Object.is.x").is_none());
        assert!(runtime_static::<A>("Number.is").is_none());
    }

    /// Two reads of a static function are one function, as `Object.is ===
    /// Object.is` is in JavaScript: a built-in, equal by its name, with
    /// nothing held anywhere — what a compiled read answers, the accessor's
    /// value.
    #[test]
    fn static_identity() {
        let first: Any<A> = Function::from(object_is::<A>()).to_any();
        let second: Any<A> = Function::from(object_is::<A>()).to_any();
        assert_eq!(first, second);
        assert!(first.same_value(&second));
        assert_ne!(
            first,
            Function::from(runtime_static::<A>("Number.isNaN").unwrap()).to_any()
        );
    }

    /// `Object.entries` is written here, not generated, and listed in the
    /// compiled table beside the bodies: every read answers one function by
    /// name, of `length` `1` and the text of its name, whose call lists the
    /// entries.
    #[test]
    fn built_in_entries() {
        let entries: Any<A> = Function::from(object_entries::<A>()).to_any();
        assert_eq!(
            entries,
            Function::from(runtime_static::<A>("Object.entries").unwrap()).to_any()
        );
        assert_eq!(entries, Function::from(object_entries::<A>()).to_any());
        assert!(entries.same_value(&Function::from(object_entries::<A>()).to_any()));
        assert_eq!(
            Any::dot(entries.clone(), "length".into()).end(),
            Ok(1.0.to_any())
        );
        assert_eq!(
            entries.clone().to_string(),
            Ok("function entries() { [native code] }".into())
        );
        let pairs = entries
            .clone()
            .call(["ab".into()].to_array().to_any())
            .unwrap();
        assert_eq!(pairs.to_json(), Ok(r#"[["0","a"],["1","b"]]"#.into()));
        assert!(entries.call([].to_array().to_any()).is_err());
    }

    /// The body asked as a call step asks it, through `dot`: with the
    /// receiver alone first, `undefined` for every receiver that is no
    /// string and the function of the arguments for a string, then that
    /// function called with the arguments — the compiled `startsWith`, on
    /// NaNVM. A nullish receiver is `hasEntry`'s throw, as a call step
    /// threw for it before asking.
    #[test]
    fn starts_with() {
        let stage = |receiver: Any<A>| runtime_dot(receiver, "startsWith".into());
        for receiver in [
            1.0.to_any(),
            true.to_any(),
            [].to_array().to_any(),
            [].to_object().to_any(),
        ] {
            assert!(stage(receiver).unwrap().is_nullish());
        }
        assert!(stage(Any::undefined()).is_err());
        let on_abc = stage("abc".into()).unwrap();
        assert!(!on_abc.is_nullish());
        let call = |args: &[Any<A>]| on_abc.clone().call(args.to_vec().to_array().to_any());
        assert_eq!(call(&["ab".into()]), Ok(true.to_any()));
        assert_eq!(call(&["bc".into()]), Ok(false.to_any()));
        assert_eq!(call(&["bc".into(), 1.0.to_any()]), Ok(true.to_any()));
        assert_eq!(call(&["".into(), 9.0.to_any()]), Ok(true.to_any()));
        assert!(call(&["a".into(), BigInt::<A>::from(0i64).to_any()]).is_err());
        // The search is converted before the position: its own `toString`'s
        // throw wins over the bigint position's `TypeError`.
        let boom = A::static_function(|_, _| Err("A".into()), 0, [].to_array(), None).to_any();
        let search: Any<A> = [("toString".into(), boom)].to_object().to_any();
        assert_eq!(
            call(&[search, BigInt::<A>::from(0i64).to_any()]),
            Err("A".into())
        );
    }
}
