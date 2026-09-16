use nanvm_lib::vm::{Any, IVm, String, ToAny};

/// NOT machine-generated: a hand-written stand-in for what `fjs compile`
/// would emit for `../../fixtures/string.f.mjs` (`export default "hello";`).
pub fn module<A: IVm>() -> Any<A> {
    String::<A>::from("hello").to_any()
}
