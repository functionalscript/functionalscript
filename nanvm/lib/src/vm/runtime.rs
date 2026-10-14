//! The runtime, `fjs/js/runtime`, bound: the module `npm run gen` compiles
//! from it into `gen.runtime.rs` beside this file, through the compiler's
//! Rust backend, and [`runtime_method`], which reads the compiled object's
//! entry for a receiver type and a key. A VM with static functions, which
//! every compiled function is, answers [`IVm::runtime_method`] with it; the
//! native tables in `vm/lambda` keep every name without a body, and may
//! keep a name that has one where a measurement justifies the second
//! implementation.

use crate::vm::{Any, IStaticFunction, IVm, Unpacked};

/// The compiled runtime: a `#[path]`, since a `gen.` name is not a Rust
/// identifier.
#[path = "gen.runtime.rs"]
mod compiled;

/// The body the runtime holds under the receiver type and the key, if a
/// function: `runtime[type_name][key]` of the compiled module's export
/// object. `None` for a name the type's object lacks, for a type the
/// runtime does not key, and for an entry that is no function. The module
/// is evaluated on every call; a VM that measures the cost may hold the
/// object instead.
pub fn runtime_method<A: IStaticFunction>(type_name: &str, key: &Any<A>) -> Option<Any<A>> {
    let module = compiled::module::<A>().ok()?;
    let table = Any::dot(module, "runtime".into()).end().ok()?;
    let functions = Any::dot(table, type_name.into()).end().ok()?;
    let entry = Any::dot(functions, key.clone()).end().ok()?;
    match Unpacked::from(entry.clone()) {
        Unpacked::Function(_) => Some(entry),
        _ => None,
    }
}

/// The receiver's type as the runtime keys it, `None` for a nullish
/// receiver, which has no type there and no member function anywhere.
pub(crate) fn type_name<A: IVm>(receiver: &Any<A>) -> Option<&'static str> {
    Some(match Unpacked::from(receiver.clone()) {
        Unpacked::Nullish(_) => return None,
        Unpacked::Boolean(_) => "boolean",
        Unpacked::Number(_) => "number",
        Unpacked::String(_) => "string",
        Unpacked::BigInt(_) => "bigint",
        Unpacked::Object(_) => "object",
        Unpacked::Array(_) => "array",
        Unpacked::Function(_) => "function",
    })
}

#[cfg(test)]
mod tests {
    use super::{runtime_method, type_name};
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
            ([].to_object().to_any(), "object"),
            ([].to_array().to_any(), "array"),
            ("".into(), "string"),
            (0.0.to_any(), "number"),
            (true.to_any(), "boolean"),
            (BigInt::<A>::from(0i64).to_any(), "bigint"),
            (f, "function"),
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
        assert!(runtime_method::<A>("string", &"startsWith".into()).is_some());
        assert!(runtime_method::<A>("string", &"slice".into()).is_none());
        assert!(runtime_method::<A>("string", &"nothing".into()).is_none());
        assert!(runtime_method::<A>("symbol", &"startsWith".into()).is_none());
    }

    /// The body called as a call step calls it, the receiver first: the
    /// compiled `startsWith`, on NaNVM.
    #[test]
    fn starts_with() {
        let f = runtime_method::<A>("string", &"startsWith".into()).unwrap();
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
