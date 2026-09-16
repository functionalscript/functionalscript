use nanvm_lib::vm::{Any, IVm, ToAny};

/// NOT machine-generated: a hand-written stand-in for what `fjs compile`
/// would emit for `../../fixtures/number.mjs` (`export default 42;`).
pub fn module<A: IVm>() -> Any<A> {
    42.0.to_any()
}
