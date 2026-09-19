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
#[path = "../fixtures/function.rs"]
pub mod function;
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

use nanvm_lib::vm::{Any, IVm};

/// Evaluates a module's `export default` and renders it as JSON.
///
/// `module` is exactly the shape `mvp-roadmap.md`'s Rust code generator
/// section says generated modules expose: `pub fn module<A: IVm>() ->
/// Result<Any<A>, Any<A>>`, not a `main`.
///
/// A function-valued export is invoked by the generated module's static call
/// before this helper serializes the returned value.
pub fn run<A: IVm>(module: fn() -> Result<Any<A>, Any<A>>) -> Result<std::string::String, std::string::String> {
    module()
        .map_err(|error| format!("runtime error: {error:?}"))?
        .to_json()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use nanvm_lib::naive::Naive;

    use crate::{array, boolean, function, number, object, property, rest_function, run, sharing, string};

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
    fn no_argument_function() {
        assert_eq!(run::<Naive>(function::module), Ok("42".into()));
    }

    #[test]
    fn rest_function() {
        assert_eq!(run::<Naive>(rest_function::module), Ok("[]".into()));
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
}
