//! The runtime, `fjs/js/runtime`, bound: the module `npm run gen` compiles
//! from it into `gen.runtime.rs` beside this file, through the compiler's
//! Rust backend, [`runtime_method`], which reads the compiled object's
//! entry for a receiver type and a key, and [`runtime_static`], which reads
//! its `static` section at a path. A VM with static functions, which
//! every compiled function is, answers [`IVm::runtime_method`] with it; the
//! native tables in `vm/lambda` keep every name without a body, and may
//! keep a name that has one where a measurement justifies the second
//! implementation.

use crate::vm::{Any, IStaticFunction, IVm, Unpacked};

/// The compiled runtime: a `#[path]`, since a `gen.` name is not a Rust
/// identifier.
#[path = "gen.runtime.rs"]
mod compiled;

/// The function value at a path of keys into the compiled runtime's
/// export object, `None` where a key is missing, a step is no object, or
/// the end is no function. The module is evaluated on every call; a VM
/// that measures the cost may hold the object instead.
fn at<A: IStaticFunction>(path: impl IntoIterator<Item = Any<A>>) -> Option<Any<A>> {
    let module = compiled::module::<A>().ok()?;
    let mut value = Any::dot(module, "runtime".into()).end().ok()?;
    for key in path {
        value = Any::dot(value, key).end().ok()?;
    }
    match Unpacked::from(value.clone()) {
        Unpacked::Function(_) => Some(value),
        _ => None,
    }
}

/// The body the runtime holds under the receiver type and the key, if a
/// function: `runtime.member[type_name][key]` of the compiled module's
/// export object. `None` for a name the type's object lacks, for a type
/// the section does not key, and for an entry that is no function.
pub fn runtime_method<A: IStaticFunction>(type_name: &str, key: &Any<A>) -> Option<Any<A>> {
    at(["member".into(), type_name.into(), key.clone()])
}

/// The body the runtime's `static` section holds at `path`, if a function:
/// `runtime.static.Object.is` for `["Object", "is"]`, the path
/// `fjs/js/static` admits the static under. `None` for a path the section
/// lacks, a step that is no object, and an entry that is no function.
pub fn runtime_static<A: IStaticFunction>(path: &[&str]) -> Option<Any<A>> {
    at(["static"].iter().chain(path).map(|key| (*key).into()))
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
    use super::{runtime_method, runtime_static, static_binding, type_name};
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, IStaticFunction, ToAny, ToArray, ToObject},
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
    /// unknown name and an unknown type are not.
    #[test]
    fn lookup() {
        assert!(runtime_method::<A>("String", &"startsWith".into()).is_some());
        assert!(runtime_method::<A>("String", &"slice".into()).is_none());
        assert!(runtime_method::<A>("String", &"nothing".into()).is_none());
        assert!(runtime_method::<A>("Symbol", &"startsWith".into()).is_none());
        assert!(runtime_method::<A>("string", &"startsWith".into()).is_none());
    }

    /// A static body is found at its path; a path the section lacks, a
    /// namespace that is no function and a path past a function are not.
    /// The body found is the compiled `Object.is`, SameValue.
    #[test]
    fn static_lookup() {
        let is = runtime_static::<A>(&["Object", "is"]).unwrap();
        let call = |a: Any<A>, b: Any<A>| is.clone().call([a, b].to_array().to_any());
        assert_eq!(call((-0.0).to_any(), 0.0.to_any()), Ok(false.to_any()));
        assert_eq!(
            call(f64::NAN.to_any(), f64::NAN.to_any()),
            Ok(true.to_any())
        );
        assert_eq!(call("a".into(), "a".into()), Ok(true.to_any()));
        assert!(runtime_static::<A>(&["Object"]).is_none());
        assert!(runtime_static::<A>(&["Object", "keys"]).is_none());
        assert!(runtime_static::<A>(&["Object", "is", "x"]).is_none());
        assert!(runtime_static::<A>(&["Number", "is"]).is_none());
        // a compiled read of a static function: the body, or the failure
        // naming the path, as the represented interpreter's
        assert!(static_binding::<A>(&["Object", "is"]).is_ok());
        assert_eq!(
            static_binding::<A>(&["Object", "keys"]),
            Err("no binding for the static Object.keys".into())
        );
    }

    /// The body called as a call step calls it, the receiver first: the
    /// compiled `startsWith`, on NaNVM.
    #[test]
    fn starts_with() {
        let f = runtime_method::<A>("String", &"startsWith".into()).unwrap();
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
