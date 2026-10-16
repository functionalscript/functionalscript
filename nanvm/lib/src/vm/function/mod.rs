mod debug;
mod member_access;
mod partial_eq;

use crate::vm::{Any, Array, IFunction, IVm, String, error};

/// The code of a built-in: the arguments alone, since a built-in has no
/// frame and no `self`, answering the value or the throw.
pub type RuntimeCode<A> = fn(Array<A>) -> Result<Any<A>, Any<A>>;

/// A built-in: a static function the runtime defines, generic over the VM,
/// described once and held by reference
/// ([`static-runtime.md`](../../../todo/static-runtime.md)).
///
/// `name` is the built-in's identity, JavaScript's own spelling of it,
/// `Object.entries`, unique by construction: two [`Function::Runtime`]s
/// are equal when their names are, as two reads of a built-in are one
/// function in JavaScript. The reference is a handle to call and read
/// through, never an identity — a descriptor is a promoted constant, which
/// Rust compiles once per crate that instantiates it, so two handles to
/// one built-in may be two addresses. `code` is called directly,
/// [`RuntimeCode`]. `length` and `text` answer `f.length` and `String(f)`.
pub struct RuntimeFunction<A: IVm> {
    pub name: &'static str,
    pub code: RuntimeCode<A>,
    pub length: u32,
    pub text: &'static str,
}

/// A function value: it can be called, it has a `length`, it has a text,
/// and it has an identity. Nothing else: the internal value stays private,
/// and the one way in for a closure is [`Function::new`], from a VM's own
/// value, which a VM constructs through its own capability, such as
/// [`IStaticFunction`](crate::vm::IStaticFunction).
///
/// One of two kinds. A **closure** is the VM's own value, an `Rc` in
/// `naive`, compared by identity: every construction is a new function,
/// as JavaScript makes a new function of every evaluation of an arrow,
/// and `(() => 1) === (() => 1)` is `false`. A **built-in** is a
/// [`RuntimeFunction`], compared by name: `Object.entries === Object.entries`
/// is `true` however often it is read, as a built-in is one function in
/// JavaScript. A closure is never equal to a built-in.
#[derive(Clone)]
pub enum Function<A: IVm> {
    Closure(A::InternalFunction),
    Runtime(&'static RuntimeFunction<A>),
}

impl<A: IVm> Function<A> {
    /// A closure over a VM's own value. An inherent constructor rather than
    /// `From<A::InternalFunction>`: that impl would overlap core's
    /// `From<T> for T`, since a VM may choose `InternalFunction = Function<A>`.
    pub fn new(internal: A::InternalFunction) -> Self {
        Function::Closure(internal)
    }
    /// The result of the function called with `args`, answered or thrown:
    /// a closure's own ([`IFunction::call`]), or a built-in's code.
    pub fn call(&self, args: Array<A>) -> Result<Any<A>, Any<A>> {
        match self {
            Function::Closure(f) => f.call(args),
            Function::Runtime(r) => (r.code)(args),
        }
    }
    pub fn length(&self) -> u32 {
        match self {
            Function::Closure(f) => f.length(),
            Function::Runtime(r) => r.length,
        }
    }
    /// The function's text, `String(f)`: the text the VM holds for a
    /// closure, given when it was made, or the refusal of one without a
    /// text ([`IStaticFunction`](crate::vm::IStaticFunction)); a built-in
    /// always has its text.
    pub fn text(&self) -> Result<String<A>, Any<A>> {
        match self {
            Function::Closure(f) => f.text().map(Into::into).ok_or_else(error::function_text),
            Function::Runtime(r) => Ok(r.text.into()),
        }
    }
}

impl<A: IVm> From<&'static RuntimeFunction<A>> for Function<A> {
    fn from(r: &'static RuntimeFunction<A>) -> Self {
        Function::Runtime(r)
    }
}
