use nanvm_lib::vm::{Any, IVm, ToAny};

/// NOT machine-generated: a hand-written stand-in for what `fjs compile`
/// would emit for `../../fixtures/boolean.mjs` (`export default true;`).
pub fn module<A: IVm>() -> Any<A> {
    true.to_any()
}
