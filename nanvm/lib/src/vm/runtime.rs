//! The runtime, `fjs/js/runtime`, bound: the static runtime `npm run gen`
//! compiles from it into `gen.runtime.rs` beside this file, through the
//! compiler's static-runtime printer (`fjs/compiler/rust/runtime`). Every
//! body is a static function: a static built-in's with an accessor
//! answering its [`RuntimeFunction`], since a read of one is a value, a
//! member's the code alone, of the receiver, answering `undefined` for a
//! receiver the name is no member of or the function of the arguments, a
//! closure over the receiver, since nothing reads a member as a value and a
//! call step asks it in those two steps. Two tables, `statics` by name and
//! `members` by name, are what [`runtime_static`] and [`runtime_method`]
//! search. No VM holds a runtime, and nothing is evaluated: a built-in is
//! one function by its name however often it is read, for every VM. The
//! native
//! tables in `vm/lambda` keep every name without a body, and may keep a
//! name that has one where a measurement justifies the second
//! implementation. [`object_entries`] is the one static function no body
//! can define, written here and listed in the compiled table beside the
//! bodies. The design: `fjs/js/runtime/README.md`, "How NaNVM finds it".

use crate::vm::{Any, Array, IVm, RuntimeCode, RuntimeFunction};

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

/// The code the runtime's `member` section holds under the key, or `None`:
/// a function of the receiver alone, answering `undefined` for a receiver
/// the name is no member of, or the function of the arguments as the call
/// passed them, a closure over the receiver, with no descriptor, since the
/// language never reads a member as a value. A call step asks it after the
/// receiver's own property and the native table
/// ([`method`](crate::vm::lambda) in `vm/lambda/method.rs`), and before
/// the `TypeError` for calling `undefined`; the guard of `?.()` asks the
/// first step alone, before any argument exists.
pub fn runtime_method<A: IVm>(key: &Any<A>) -> Option<RuntimeCode<A>> {
    compiled::members::<A>()
        .into_iter()
        .find(|(k, _)| key.is_str(k))
        .map(|(_, code)| code)
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
    use super::{RuntimeCode, compiled::object_is, object_entries, runtime_method, runtime_static};
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, Function, IVm, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    /// A member's code.
    fn member(key: &str) -> Option<RuntimeCode<A>> {
        runtime_method::<A>(&key.into())
    }

    /// A body is found by its name; a name without a body and an unknown
    /// name are not, and the key is the name exactly.
    #[test]
    fn lookup() {
        assert!(member("startsWith").is_some());
        assert!(member("slice").is_none());
        assert!(member("nothing").is_none());
        assert!(member("startswith").is_none());
        assert!(runtime_method::<A>(&1.0.to_any()).is_none());
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

    /// The code asked as a call step asks it: with the receiver alone
    /// first, `undefined` for every receiver that is no string and the
    /// function of the arguments for a string, then that function called
    /// with the arguments — the compiled `startsWith`, on NaNVM.
    #[test]
    fn starts_with() {
        let code = member("startsWith").unwrap();
        let stage = |receiver: Any<A>| code([receiver].to_array());
        for receiver in [
            1.0.to_any(),
            true.to_any(),
            [].to_array().to_any(),
            [].to_object().to_any(),
            Any::undefined(),
        ] {
            assert!(stage(receiver).unwrap().is_nullish());
        }
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
