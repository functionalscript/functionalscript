//! The runtime, `fjs/js/runtime`, bound: the module `npm run gen` compiles
//! from it into `gen.runtime.rs` beside this file, through the compiler's
//! Rust backend; [`runtime_object`], its `runtime` export evaluated;
//! [`runtime_method`], which reads that object's entry for a receiver type
//! and a key; and [`runtime_static`], which reads its `static` section at a
//! path. A VM with static functions, which every compiled function is,
//! holds the object and answers [`IVm::runtime_method`] and
//! [`IVm::runtime_static`] from it; the native tables in `vm/lambda` keep
//! every name without a body, and may keep a name that has one where a
//! measurement justifies the second implementation. [`Runtime`] is what
//! such a VM holds: that object and the one static function no body can
//! define, [`object_entries`], each initialized once.

use crate::vm::{Any, IStaticFunction, IVm, ToAny, ToArray, Unpacked};

/// The compiled runtime: a `#[path]`, since a `gen.` name is not a Rust
/// identifier.
#[path = "gen.runtime.rs"]
mod compiled;

/// The compiled module's `runtime` export, evaluated, or `None` where the
/// module fails: the object a VM holds and reads every body from. Its
/// evaluation builds closures and runs no body, so it never asks the VM
/// for a binding. A VM holds one object, not one per lookup, so a body
/// read twice is one function: `Object.is === Object.is`, as JavaScript
/// and the represented interpreter answer.
pub fn runtime_object<A: IStaticFunction>() -> Option<Any<A>> {
    Any::dot(compiled::module::<A>().ok()?, "runtime".into())
        .end()
        .ok()
}

/// The function value at a path of keys into the runtime object, `None`
/// where a key is missing, a step is no object, or the end is no function.
fn at<A: IVm>(runtime: Any<A>, path: impl IntoIterator<Item = Any<A>>) -> Option<Any<A>> {
    let mut value = runtime;
    for key in path {
        value = Any::dot(value, key).end().ok()?;
    }
    match Unpacked::from(value.clone()) {
        Unpacked::Function(_) => Some(value),
        _ => None,
    }
}

/// The body `runtime`, a [`runtime_object`], holds under the receiver
/// type and the key, if a function: `runtime.member[type_name][key]`.
/// `None` for a name the type's object lacks, for a type the section does
/// not key, and for an entry that is no function.
pub fn runtime_method<A: IVm>(runtime: Any<A>, type_name: &str, key: &Any<A>) -> Option<Any<A>> {
    at(runtime, ["member".into(), type_name.into(), key.clone()])
}

/// The body the `static` section of `runtime`, a [`runtime_object`],
/// holds at `path`, if a function: `runtime.static.Object.is` for
/// `["Object", "is"]`, the path `fjs/js/static` admits the static under.
/// `None` for a path the section lacks, a step that is no object, and an
/// entry that is no function.
pub fn runtime_static<A: IVm>(runtime: Any<A>, path: &[&str]) -> Option<Any<A>> {
    at(
        runtime,
        ["static"].iter().chain(path).map(|key| (*key).into()),
    )
}

/// `String(Object.entries)`: the host's own text for a built-in, as V8
/// answers it, since no EDAG holds a body to render. The represented
/// interpreter answers the same text.
const ENTRIES_TEXT: &str = "function entries() { [native code] }";

/// `Object.entries` as a function, the one static function no body can
/// define, enumerating keys being what the language has no other way to do
/// ([`Any::entries`]): created here, where every other static is a body of
/// the runtime's `static` section (`fjs/js/static`'s `natives`). Each call
/// makes a new function, so a VM holds the one [`Runtime`] creates, and
/// every read is one function.
pub fn object_entries<A: IStaticFunction>() -> Any<A> {
    A::static_function(
        |_, args| {
            args.into_iter()
                .next()
                .unwrap_or_else(Any::undefined)
                .entries()
        },
        1,
        [].to_array(),
        Some(ENTRIES_TEXT),
    )
    .to_any()
}

/// The runtime a VM holds, initialized once, from which it answers every
/// runtime function: the compiled module's `runtime` export,
/// [`runtime_object`], which holds every generated body, and the functions
/// no body defines, created beside it — [`object_entries`]. Every lookup
/// reads it, so each runtime function, generated or created, is one
/// function however often it is read, as JavaScript's built-ins are.
pub struct Runtime<A: IVm> {
    /// The compiled module's `runtime` export, `None` where the module
    /// fails, which no body lookup answers.
    object: Option<Any<A>>,
    /// `Object.entries`, created once.
    object_entries: Any<A>,
}

impl<A: IStaticFunction> Runtime<A> {
    /// The runtime initialized: the compiled module evaluated and every
    /// function no body defines created. Neither runs a body or asks the VM
    /// for a binding, so a VM may initialize it inside its first lookup.
    pub fn new() -> Self {
        Runtime {
            object: runtime_object(),
            object_entries: object_entries(),
        }
    }
}

impl<A: IStaticFunction> Default for Runtime<A> {
    fn default() -> Self {
        Self::new()
    }
}

impl<A: IVm> Runtime<A> {
    /// The member function for the receiver type and the key, a body of the
    /// compiled object, [`runtime_method`].
    pub fn method(&self, type_name: &str, key: &Any<A>) -> Option<Any<A>> {
        runtime_method(self.object.clone()?, type_name, key)
    }

    /// The static function at `path`: the one this runtime created where no
    /// body defines it, else a body of the compiled object,
    /// [`runtime_static`].
    pub fn static_function(&self, path: &[&str]) -> Option<Any<A>> {
        match path {
            ["Object", "entries"] => Some(self.object_entries.clone()),
            _ => runtime_static(self.object.clone()?, path),
        }
    }
}

/// The function a compiled read of a static function answers: the VM's
/// binding for `path`, [`IVm::runtime_static`], or the failure naming the
/// path, which the read propagates — the parser admitted the name, so a VM
/// without a binding fails rather than answer `undefined`. The represented
/// interpreter fails with the same message.
pub fn static_binding<A: IVm>(path: &[&str]) -> Result<Any<A>, Any<A>> {
    A::runtime_static(path).ok_or_else(|| {
        format!("no binding for the static {}", path.join("."))
            .as_str()
            .into()
    })
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
        Runtime, object_entries, runtime_object, runtime_static, static_binding, type_name,
    };
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, IStaticFunction, IVm, ToAny, ToArray, ToObject},
    };

    type A = Naive;

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
    /// function: the VM holds the runtime object.
    #[test]
    fn lookup() {
        assert!(A::runtime_method("String", &"startsWith".into()).is_some());
        assert!(A::runtime_method("String", &"slice".into()).is_none());
        assert!(A::runtime_method("String", &"nothing".into()).is_none());
        assert!(A::runtime_method("Symbol", &"startsWith".into()).is_none());
        assert!(A::runtime_method("string", &"startsWith".into()).is_none());
        assert_eq!(
            A::runtime_method("String", &"startsWith".into()),
            A::runtime_method("String", &"startsWith".into())
        );
    }

    /// A static body is found at its path; a path the section lacks, a
    /// namespace that is no function and a path past a function are not.
    /// The body found is the compiled `Object.is`, SameValue.
    #[test]
    fn static_lookup() {
        let is = A::runtime_static(&["Object", "is"]).unwrap();
        let call = |a: Any<A>, b: Any<A>| is.clone().call([a, b].to_array().to_any());
        assert_eq!(call((-0.0).to_any(), 0.0.to_any()), Ok(false.to_any()));
        assert_eq!(
            call(f64::NAN.to_any(), f64::NAN.to_any()),
            Ok(true.to_any())
        );
        assert_eq!(call("a".into(), "a".into()), Ok(true.to_any()));
        assert!(A::runtime_static(&["Object"]).is_none());
        assert!(A::runtime_static(&["Object", "keys"]).is_none());
        assert!(A::runtime_static(&["Object", "is", "x"]).is_none());
        assert!(A::runtime_static(&["Number", "is"]).is_none());
        // a compiled read of a static function: the body, or the failure
        // naming the path, as the represented interpreter's
        assert!(static_binding::<A>(&["Object", "is"]).is_ok());
        assert_eq!(
            static_binding::<A>(&["Object", "keys"]),
            Err("no binding for the static Object.keys".into())
        );
    }

    /// Two reads of a static function are one function, as `Object.is ===
    /// Object.is` is in JavaScript: the VM holds one runtime object, where
    /// two evaluations of the module are two, whose bodies differ.
    #[test]
    fn static_identity() {
        let first = static_binding::<A>(&["Object", "is"]).unwrap();
        assert_eq!(first, static_binding::<A>(&["Object", "is"]).unwrap());
        assert!(first.same_value(&A::runtime_static(&["Object", "is"]).unwrap()));
        let fresh = |object: Option<Any<A>>| runtime_static(object.unwrap(), &["Object", "is"]);
        assert_ne!(fresh(runtime_object::<A>()), fresh(runtime_object::<A>()));
    }

    /// `Object.entries` is created, not generated: the compiled object has
    /// no body at its path, and the runtime the VM holds creates it once,
    /// so every read is one function, of `length` `1` and the host's text,
    /// whose call lists the entries — where two creations are two
    /// functions, and two runtimes two `Object.entries`.
    #[test]
    fn created_entries() {
        let path = ["Object", "entries"];
        assert!(runtime_static(runtime_object::<A>().unwrap(), &path).is_none());
        let entries = static_binding::<A>(&path).unwrap();
        assert_eq!(entries, static_binding::<A>(&path).unwrap());
        assert_eq!(entries, A::runtime_static(&path).unwrap());
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
        assert_ne!(object_entries::<A>(), object_entries::<A>());
        let runtime = Runtime::<A>::new();
        assert_eq!(
            runtime.static_function(&path),
            runtime.static_function(&path)
        );
        assert_ne!(
            runtime.static_function(&path),
            Runtime::<A>::new().static_function(&path)
        );
        assert!(runtime.static_function(&["Object", "is"]).is_some());
        assert!(runtime.static_function(&["Object", "keys"]).is_none());
        assert!(runtime.method("String", &"startsWith".into()).is_some());
    }

    /// The body called as a call step calls it, the receiver first: the
    /// compiled `startsWith`, on NaNVM.
    #[test]
    fn starts_with() {
        let f = A::runtime_method("String", &"startsWith".into()).unwrap();
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
