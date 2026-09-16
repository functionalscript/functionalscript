//! The MVP walking skeleton (`todo/fjs-nanvm-integration.md`,
//! `nanvm-lib/todo/mvp-roadmap.md`): evaluate a compiled module's
//! `export default` and print it as JSON.
//!
//! `fjs compile <module> <output>.rs` (the Rust code generator) does not
//! exist yet, so [`synthetic`] hand-writes the shape it will eventually
//! produce — see that module's own doc comment for why, and for how it's
//! kept visually distinct from real generated output.

pub mod synthetic;

use nanvm_lib::vm::{Any, IVm, JsonError};

/// Evaluates a module's `export default` and renders it as JSON.
///
/// `module` is exactly the shape `mvp-roadmap.md`'s Rust code generator
/// section says generated modules will expose: `pub fn module<A: IVm>() ->
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

    use crate::{run, synthetic};

    #[test]
    fn number_constant() {
        assert_eq!(run::<Naive>(synthetic::number::module), Ok("42".into()));
    }

    #[test]
    fn string_constant() {
        assert_eq!(
            run::<Naive>(synthetic::string::module),
            Ok(r#""hello""#.into())
        );
    }

    #[test]
    fn boolean_constant() {
        assert_eq!(run::<Naive>(synthetic::boolean::module), Ok("true".into()));
    }
}
