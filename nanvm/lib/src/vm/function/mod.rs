mod debug;
mod member_access;
mod partial_eq;

use crate::vm::{Any, Array, IFunction, IVm, String, error};

/// A function value: it can be called, it has a `length`, it has a text,
/// and it has an identity. Nothing else. It holds a VM's own value, laid
/// out as [`Unpacked`](crate::vm::Unpacked) lays out every value, which the
/// VM constructs through its own capability, such as
/// [`IStaticFunction`](crate::vm::IStaticFunction), and [`Function::new`]
/// wraps.
///
/// Compared by identity, an `Rc` in `naive`: every construction is a new
/// function, as JavaScript makes a new function of every evaluation of an
/// arrow, and `(() => 1) === (() => 1)` is `false`. A built-in is no kind
/// apart: it is a closure of the runtime value, `vm::runtime`, built once
/// and read from the value, so `Object.is === Object.is` holds because
/// both reads find the one closure, and its text is the NativeFunction
/// text the compiled runtime gave it (`fjs/js/runtime/README.md`, "How
/// NaNVM finds it").
#[derive(Clone)]
pub struct Function<A: IVm>(A::InternalFunction);

impl<A: IVm> Function<A> {
    pub fn new(internal: A::InternalFunction) -> Self {
        Function(internal)
    }
    /// Call the function with an arguments array. No user function reads
    /// `this`, so there is no receiver to pass.
    pub fn call(&self, args: Array<A>) -> Result<Any<A>, Any<A>> {
        self.0.call(args)
    }
    /// `f.length`.
    pub fn length(&self) -> u32 {
        self.0.length()
    }
    /// `String(f)`: the text the function was given, or the refusal of a
    /// function without one (`error::function_text`).
    pub fn text(&self) -> Result<String<A>, Any<A>> {
        self.0
            .text()
            .map(Into::into)
            .ok_or_else(error::function_text)
    }
    /// The VM's own value.
    pub(crate) fn internal(&self) -> &A::InternalFunction {
        &self.0
    }
}
