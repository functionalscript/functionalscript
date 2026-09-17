//! The MVP walking skeleton (`todo/fjs-nanvm-integration.md`,
//! `nanvm-lib/todo/mvp-roadmap.md`): evaluate a compiled module's
//! `export default` and print it as JSON.
//!
//! [`generated`] is real `fjs compile <module> <output>.rs` output,
//! produced at build time (`build.rs`) from the FunctionalScript sources
//! under `fixtures/` — not a hand-written stand-in. `cargo build`/`cargo
//! test` on this crate therefore exercises the actual source -> compiler ->
//! Rust -> cargo pipeline `mvp-roadmap.md` defines as the MVP, not a
//! duplicate of what the compiler would produce.

pub mod generated;

use nanvm_lib::vm::{Any, IVm, JsonError};

/// Evaluates a module's `export default` and renders it as JSON.
///
/// `module` is exactly the shape `mvp-roadmap.md`'s Rust code generator
/// section says generated modules expose: `pub fn module<A: IVm>() ->
/// Any<A>`, not a `main`.
///
/// A generated module's default export may be a function, which the
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

    use crate::{generated, run};

    #[test]
    fn number_constant() {
        assert_eq!(run::<Naive>(generated::number::module), Ok("42".into()));
    }

    #[test]
    fn string_constant() {
        assert_eq!(
            run::<Naive>(generated::string::module),
            Ok(r#""hello""#.into())
        );
    }

    #[test]
    fn boolean_constant() {
        assert_eq!(run::<Naive>(generated::boolean::module), Ok("true".into()));
    }
}
