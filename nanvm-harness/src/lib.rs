//! The MVP walking skeleton (`todo/fjs-nanvm-integration.md`,
//! `nanvm-lib/todo/mvp-roadmap.md`): evaluate a compiled module's
//! `export default` and print it as JSON.
//!
//! `fjs compile <module> <output>.rs` (the Rust code generator) compiles
//! each of `fixtures/*.mjs` into a sibling `fixtures/*.rs`, committed and
//! drift-checked by `npm run gen` (see `../fjs/ci/README.md`) the same way
//! `nanvm-lib/tests/test/generated.rs` is. The three modules below pull
//! those generated files in via `#[path]`, since they live beside the FJS
//! source they were compiled from rather than under `src/`.

#[path = "../fixtures/boolean.rs"]
pub mod boolean;
#[path = "../fixtures/number.rs"]
pub mod number;
#[path = "../fixtures/string.rs"]
pub mod string;

use nanvm_lib::vm::{Any, IVm, JsonError};

/// Evaluates a module's `export default` and renders it as JSON.
///
/// `module` is exactly the shape `mvp-roadmap.md`'s Rust code generator
/// section says generated modules expose: `pub fn module<A: IVm>() ->
/// Any<A>`, not a `main`.
///
/// A real generated module's default export may be a function, which the
/// harness's job is to run before printing its result
/// (`fjs-nanvm-integration.md`). `nanvm-lib` has no `Function`
/// constructor/interpreter yet — that's `mvp-roadmap.md`'s P2 "`Function`
/// constructor + interpreter" task, gated behind a future cargo feature —
/// so there is no way to call one here. A function export therefore comes
/// out of [`Any::to_json`] as [`JsonError::Function`], the same as every
/// other value this minimal serializer doesn't (yet) handle.
pub fn run<A: IVm>(module: fn() -> Any<A>) -> Result<std::string::String, JsonError> {
    module().to_json()
}

#[cfg(test)]
mod tests {
    use nanvm_lib::naive::Naive;

    use crate::{boolean, number, run, string};

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
}
