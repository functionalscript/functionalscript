//! The MVP walking skeleton (`todo/fjs-nanvm-integration.md`,
//! `nanvm-lib/todo/mvp-roadmap.md`): evaluate a compiled module's
//! `export default` and print it as JSON.
//!
//! `fjs compile <module> <output>.rs` (the Rust code generator) compiles
//! each of `fixtures/*.mjs` into a sibling `fixtures/*.rs`, committed and
//! drift-checked by `npm run gen` (see `../../fjs/ci/README.md`) the same way
//! `nanvm-lib/tests/test/generated.rs` is. The modules below pull those
//! generated files in via `#[path]`, since they live beside the FJS source
//! they were compiled from rather than under `src/`.

#[path = "../fixtures/array.rs"]
pub mod array;
#[path = "../fixtures/boolean.rs"]
pub mod boolean;
#[path = "../fixtures/escapes.rs"]
pub mod escapes;
#[path = "../fixtures/function.rs"]
pub mod function;
#[path = "../fixtures/named.rs"]
pub mod named;
#[path = "../fixtures/number.rs"]
pub mod number;
#[path = "../fixtures/object.rs"]
pub mod object;
#[path = "../fixtures/property.rs"]
pub mod property;
#[path = "../fixtures/rest-function.rs"]
pub mod rest_function;
#[path = "../fixtures/sharing.rs"]
pub mod sharing;
#[path = "../fixtures/string.rs"]
pub mod string;

use core::fmt::{self, Debug, Display, Formatter};

use nanvm_lib::vm::{Any, IVm, JsonError};

/// Why a run produced no JSON: the module threw, or its value has no JSON.
///
/// A throw is the language's own failure — `1n / 0n`, a property read on a
/// nullish base the compiler could not see — and the thrown value is an
/// ordinary `Any<A>`, reported as the value it is rather than turned into a
/// panic.
///
/// `Debug` and `PartialEq` are written out rather than derived: a derive
/// would ask them of `A` itself, which no VM promises, where `Any<A>` has
/// both for every VM.
pub enum RunError<A: IVm> {
    Thrown(Any<A>),
    Json(JsonError),
}

impl<A: IVm> Display for RunError<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            RunError::Thrown(v) => write!(f, "uncaught {v:?}"),
            RunError::Json(e) => Display::fmt(e, f),
        }
    }
}

impl<A: IVm> Debug for RunError<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            RunError::Thrown(v) => f.debug_tuple("Thrown").field(v).finish(),
            RunError::Json(e) => f.debug_tuple("Json").field(e).finish(),
        }
    }
}

impl<A: IVm> PartialEq for RunError<A> {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (RunError::Thrown(a), RunError::Thrown(b)) => a == b,
            (RunError::Json(a), RunError::Json(b)) => a == b,
            _ => false,
        }
    }
}

/// Evaluates a module's `export default` and renders it as JSON.
///
/// `module` is exactly the shape `mvp-roadmap.md`'s Rust code generator
/// section says generated modules expose: `pub fn module<A: IVm>() ->
/// Result<Any<A>, Any<A>>`, returning the object of all exports, or the
/// value the module threw. The harness selects the object's `default`
/// property for the JSON result.
///
/// A real generated module's default export may be a function, which the
/// harness's job is to run before printing its result
/// (`fjs-nanvm-integration.md`). `nanvm-lib` has no `Function`
/// constructor/interpreter yet — that's `mvp-roadmap.md`'s P2 "`Function`
/// constructor + interpreter" task, gated behind a future cargo feature —
/// so there is no way to call one here. A function export therefore comes
/// out of [`Any::to_json`] as [`JsonError::Function`], the same as every
/// other value this minimal serializer doesn't (yet) handle.
pub fn run<A: IVm>(
    module: fn() -> Result<Any<A>, Any<A>>,
) -> Result<std::string::String, RunError<A>> {
    module()
        .map_err(RunError::Thrown)?
        .member_access("default".into())
        .expect("a compiled module returns its export object")
        .to_json()
        .map_err(RunError::Json)
}

#[cfg(test)]
mod tests {
    use nanvm_lib::{
        naive::Naive,
        vm::{Any, IVm},
    };

    use crate::{
        RunError, array, boolean, escapes, function, named, number, object, property, rest_function, run, sharing, string,
    };

    #[test]
    fn module_result_contains_exports() {
        assert_eq!(
            number::module::<Naive>().unwrap().to_json(),
            Ok(r#"{"default":42}"#.into())
        );
        assert_eq!(
            object::module::<Naive>().unwrap().to_json(),
            Ok(r#"{"default":{"a":1,"b":"two"}}"#.into())
        );
    }

    /// No committed fixture throws yet — no operator compiles to `.rs` — so
    /// the throwing module is written by hand, in the shape the generator
    /// prints.
    fn throwing<A: IVm>() -> Result<Any<A>, Any<A>> {
        Err("boom".into())
    }

    #[test]
    fn thrown_value_is_reported_not_panicked() {
        let error = run::<Naive>(throwing).unwrap_err();
        assert!(matches!(&error, RunError::Thrown(v) if *v == "boom".into()));
        assert_eq!(error.to_string(), "uncaught \"boom\"");
    }

    #[test]
    fn named_exports() {
        assert_eq!(
            named::module::<Naive>().unwrap().to_json(),
            Ok(r#"{"a":[5],"default":[5],"z":[5]}"#.into())
        );
        assert_eq!(run::<Naive>(named::module), Ok("[5]".into()));
    }

    #[test]
    fn number_constant() {
        assert_eq!(run::<Naive>(number::module), Ok("42".into()));
    }

    #[test]
    fn string_constant() {
        assert_eq!(run::<Naive>(string::module), Ok(r#""hello""#.into()));
    }

    #[test]
    fn boolean_constant() {
        assert_eq!(run::<Naive>(boolean::module), Ok("true".into()));
    }

    #[test]
    fn array_literal() {
        assert_eq!(run::<Naive>(array::module), Ok("[1,2,3]".into()));
    }

    #[test]
    fn object_literal() {
        assert_eq!(
            run::<Naive>(object::module),
            Ok(r#"{"a":1,"b":"two"}"#.into())
        );
    }

    #[test]
    fn shared_object_reference() {
        // `[shared, shared]` is one object reached from two places, printed
        // as a single `let c0` binding cloned at each reference
        // (`sharing.rs`) — this only proves the JSON is right; the sharing
        // itself is a property of the generated Rust, not something the
        // JSON output could distinguish from two separate literal objects.
        assert_eq!(
            run::<Naive>(sharing::module),
            Ok(r#"[{"x":1},{"x":1}]"#.into())
        );
    }

    #[test]
    fn property_access() {
        assert_eq!(run::<Naive>(property::module), Ok("42".into()));
    }

    #[test]
    fn no_argument_function() {
        assert_eq!(run::<Naive>(function::module), Ok("42".into()));
    }

    #[test]
    fn rest_function() {
        assert_eq!(run::<Naive>(rest_function::module), Ok("[]".into()));
    }

    #[test]
    fn escaped_characters() {
        // `escapes.rs` spells each of these as a `\u{…}` escape, since a
        // control character or a bidirectional control cannot stand in a
        // Rust literal as it is; the VM reads back the character itself.
        // `to_json` escapes the two control characters and prints the rest.
        assert_eq!(
            run::<Naive>(escapes::module),
            Ok("[\"\\u0000\",\"\\u001f\",\"\u{7f}\",\"\u{202e}\",\"\u{2069}\"]".into())
        );
    }
}
