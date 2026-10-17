//! The runtime, `fjs/js/runtime`, bound: the static runtime `npm run gen`
//! compiles from it into `gen.runtime.rs` beside this file, through the
//! compiler's static-runtime printer (`fjs/compiler/rust/runtime`). Every
//! body is a static function with an accessor answering its
//! [`RuntimeFunction`], and two tables, `statics` by name and `members` by
//! receiver type and key, are what [`runtime_static`] and
//! [`runtime_method`] search. No VM holds a runtime, and nothing is
//! evaluated: a built-in is one function by its name however often it is
//! read, for every VM (`nanvm/lib/todo/static-runtime.md`). The native
//! tables in `vm/lambda` keep every name without a body, and may keep a
//! name that has one where a measurement justifies the second
//! implementation. [`object_entries`] is the one static function no body
//! can define, written here and listed in the compiled table beside the
//! bodies.

use crate::vm::{Any, Array, Function, IVm, RuntimeFunction, ToAny, Unpacked};

/// The compiled runtime: a `#[path]`, since a `gen.` name is not a Rust
/// identifier.
#[path = "gen.runtime.rs"]
mod compiled;

/// The static function `name` names, JavaScript's own spelling of it,
/// `Object.is`: a body of the runtime's `static` section, or a native
/// written here, `Object.entries`; `None` for a name the runtime lacks.
pub fn runtime_static<A: IVm>(name: &str) -> Option<&'static RuntimeFunction<A>> {
    compiled::statics::<A>()
        .into_iter()
        .find(|(n, _)| *n == name)
        .map(|(_, accessor)| accessor())
}

/// The body the runtime's `member` section holds for the receiver type
/// `type_name` names — `Object`, `Array`, `String`, `Number`, `Boolean`,
/// `BigInt` or `Function`, the globals' names, as the section keys them —
/// and the key, or `None`. A call step asks it after the receiver's own
/// property and the native table ([`method`](crate::vm::lambda) in
/// `vm/lambda/method.rs`), and before the `TypeError` for calling
/// `undefined`.
pub fn runtime_method<A: IVm>(
    type_name: &str,
    key: &Any<A>,
) -> Option<&'static RuntimeFunction<A>> {
    compiled::members::<A>()
        .into_iter()
        .find(|(t, k, _)| *t == type_name && key.is_str(k))
        .map(|(_, _, accessor)| accessor())
}

/// The code of `Object.entries`: the entries of its first argument,
/// [`Any::entries`].
fn entries_code<A: IVm>(args: Array<A>) -> Result<Any<A>, Any<A>> {
    args.into_iter()
        .next()
        .unwrap_or_else(Any::undefined)
        .entries()
}

/// The text of `Object.entries`, `String(f)`: what ECMA-262 requires of a
/// built-in function, NativeFunction syntax naming its [[InitialName]],
/// with no parameters, as most engines print it. The represented
/// interpreter spells the same text, `entriesText` in
/// `fjs/edag/value/entries`; `nanvm/harness/fixtures/object-entries.mjs`
/// checks the two agree.
pub const ENTRIES_TEXT: &str = "function entries() { [native code] }";

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
        text: ENTRIES_TEXT,
    }
}

/// The function a compiled read of a static function answers: the built-in
/// at `path`, the keys `fjs/js/static` admits it under, as a value, or the
/// failure naming the path, which the read propagates — the parser admitted
/// the name, so a runtime without the function fails rather than answer
/// `undefined`. The represented interpreter fails with the same message.
pub fn static_binding<A: IVm>(path: &[&str]) -> Result<Any<A>, Any<A>> {
    let name = path.join(".");
    runtime_static(&name)
        .map(|built_in| Function::from(built_in).to_any())
        .ok_or_else(|| format!("no binding for the static {name}").as_str().into())
}

/// The receiver's type as the runtime keys it, the name of its global;
/// `None` for a nullish receiver, which has no type there and no member
/// function anywhere.
pub(crate) fn type_name<A: IVm>(receiver: &Any<A>) -> Option<&'static str> {
    Some(match Unpacked::from(receiver.clone()) {
        Unpacked::Nullish(_) => return None,
        Unpacked::Boolean(_) => "Boolean",
        Unpacked::Number(_) => "Number",
        Unpacked::String(_) => "String",
        Unpacked::BigInt(_) => "BigInt",
        Unpacked::Object(_) => "Object",
        Unpacked::Array(_) => "Array",
        Unpacked::Function(_) => "Function",
    })
}

#[cfg(test)]
mod tests {
    use super::{
        ENTRIES_TEXT, object_entries, runtime_method, runtime_static, static_binding, type_name,
    };
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, Function, IStaticFunction, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    /// A member body as a value.
    fn member(type_name: &str, key: &str) -> Option<Any<A>> {
        runtime_method::<A>(type_name, &key.into()).map(|f| Function::from(f).to_any())
    }

    /// Every type the runtime keys, and the nullish values it does not.
    #[test]
    fn type_names() {
        let f: Any<A> =
            A::static_function(|_, _| Ok(1.0.to_any()), 0, [].to_array(), None).to_any();
        let typed: [(Any<A>, &str); 7] = [
            ([].to_object().to_any(), "Object"),
            ([].to_array().to_any(), "Array"),
            ("".into(), "String"),
            (0.0.to_any(), "Number"),
            (true.to_any(), "Boolean"),
            (BigInt::<A>::from(0i64).to_any(), "BigInt"),
            (f, "Function"),
        ];
        for (receiver, name) in typed {
            assert_eq!(type_name(&receiver), Some(name));
        }
        assert_eq!(type_name(&Any::<A>::undefined()), None);
    }

    /// A body is found by its type and name; a name without a body, an
    /// unknown name and an unknown type are not. Read twice, a body is one
    /// function: a built-in, by its name.
    #[test]
    fn lookup() {
        assert!(member("String", "startsWith").is_some());
        assert!(member("String", "slice").is_none());
        assert!(member("String", "nothing").is_none());
        assert!(member("Symbol", "startsWith").is_none());
        assert!(member("string", "startsWith").is_none());
        assert_eq!(
            member("String", "startsWith"),
            member("String", "startsWith")
        );
    }

    /// A static body is found by its name; a name the section lacks, a
    /// namespace that is no function and a name past a function are not.
    /// The body found is the compiled `Object.is`, SameValue.
    #[test]
    fn static_lookup() {
        let is: Any<A> = Function::from(runtime_static::<A>("Object.is").unwrap()).to_any();
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
        // a compiled read of a static function: the body, or the failure
        // naming the path, as the represented interpreter's
        assert!(static_binding::<A>(&["Object", "is"]).is_ok());
        assert_eq!(
            static_binding::<A>(&["Object", "keys"]),
            Err("no binding for the static Object.keys".into())
        );
    }

    /// Two reads of a static function are one function, as `Object.is ===
    /// Object.is` is in JavaScript: a built-in, equal by its name, with
    /// nothing held anywhere.
    #[test]
    fn static_identity() {
        let first = static_binding::<A>(&["Object", "is"]).unwrap();
        let second = static_binding::<A>(&["Object", "is"]).unwrap();
        assert_eq!(first, second);
        assert!(first.same_value(&second));
        assert_ne!(first, static_binding::<A>(&["Number", "isNaN"]).unwrap());
    }

    /// `Object.entries` is written here, not generated, and listed in the
    /// compiled table beside the bodies: every read answers one function by
    /// name, of `length` `1` and its text, whose call lists the entries.
    #[test]
    fn built_in_entries() {
        let path = ["Object", "entries"];
        let entries = static_binding::<A>(&path).unwrap();
        assert_eq!(entries, static_binding::<A>(&path).unwrap());
        assert_eq!(entries, Function::from(object_entries::<A>()).to_any());
        assert!(entries.same_value(&Function::from(object_entries::<A>()).to_any()));
        assert_eq!(
            Any::dot(entries.clone(), "length".into()).end(),
            Ok(1.0.to_any())
        );
        assert_eq!(entries.clone().to_string(), Ok(ENTRIES_TEXT.into()));
        let pairs = entries
            .clone()
            .call(["ab".into()].to_array().to_any())
            .unwrap();
        assert_eq!(pairs.to_json(), Ok(r#"[["0","a"],["1","b"]]"#.into()));
        assert!(entries.call([].to_array().to_any()).is_err());
    }

    /// The body called as a call step calls it, the receiver first: the
    /// compiled `startsWith`, on NaNVM.
    #[test]
    fn starts_with() {
        let f = member("String", "startsWith").unwrap();
        fn call<const N: usize>(f: &Any<A>, args: [Any<A>; N]) -> Result<Any<A>, Any<A>> {
            f.clone().call(args.to_array().to_any())
        }
        assert_eq!(call(&f, ["abc".into(), "ab".into()]), Ok(true.to_any()));
        assert_eq!(call(&f, ["abc".into(), "bc".into()]), Ok(false.to_any()));
        assert_eq!(
            call(&f, ["abc".into(), "bc".into(), 1.0.to_any()]),
            Ok(true.to_any())
        );
        assert_eq!(
            call(&f, ["abc".into(), "".into(), 9.0.to_any()]),
            Ok(true.to_any())
        );
        assert!(
            call(
                &f,
                ["abc".into(), "a".into(), BigInt::<A>::from(0i64).to_any()]
            )
            .is_err()
        );
        // The search is converted before the position: its own `toString`'s
        // throw wins over the bigint position's `TypeError`.
        let boom = A::static_function(|_, _| Err("A".into()), 0, [].to_array(), None).to_any();
        let search: Any<A> = [("toString".into(), boom)].to_object().to_any();
        assert_eq!(
            call(&f, ["abc".into(), search, BigInt::<A>::from(0i64).to_any()]),
            Err("A".into())
        );
    }
}
