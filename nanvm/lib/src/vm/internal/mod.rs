mod icomplex;
mod icontainer;
mod ifunction;
mod istatic_function;

pub use icomplex::IComplex;
pub use icontainer::IContainer;
pub use ifunction::IFunction;
pub use istatic_function::{IStaticFunction, StaticCode};

use crate::{
    sign::Sign,
    vm::{Any, Array, Function, Property, Unpacked},
};

/// A VM's value representation.
///
/// A VM is built from an [`Unpacked`] value alone, so a number reaches it
/// only as a [`Number`](crate::vm::Number), which holds one `NaN` by
/// construction — there is no `From<f64>` here on purpose — so a NaN-boxing
/// VM, which reads a negative quiet `NaN` as a boxed value, can store its
/// bits as they are.
///
/// A VM is `'static`: a type with no lifetime, which a built-in's
/// descriptor names behind a `'static` reference
/// ([`RuntimeFunction`](crate::vm::RuntimeFunction)). The runtime is not
/// the VM's to bind: every built-in is a static function of the compiled
/// runtime, which a call step and a compiled read reach for any VM
/// ([`runtime_dot`](crate::vm::runtime_dot),
/// [`runtime_static`](crate::vm::runtime_static)).
pub trait IVm: Sized + Clone + From<Unpacked<Self>> + 'static {
    // types
    type InternalString: IContainer<Self, Header = (), Item = u16>;
    type InternalBigInt: IContainer<Self, Header = Sign, Item = u64>;
    type InternalObject: IContainer<Self, Header = (), Item = Property<Self>>;
    type InternalArray: IContainer<Self, Header = (), Item = Any<Self>>;
    type InternalFunction: IFunction<Self>;
    // functions
    fn to_unpacked(self) -> Unpacked<Self>;
    /// A function made out of a Rust static function, [`StaticCode`], over
    /// the frame it captures: what every closure of a compiled module is,
    /// and what the runtime's member functions answer, a closure over the
    /// receiver, which is why the capability is every VM's and not a
    /// capability apart ([`IStaticFunction`] names it). `text` is the
    /// function's text, what `String(f)` answers: the compiler renders it
    /// from the function's EDAG, one `&'static str` per arrow in the source,
    /// shared by every function the arrow makes. `None` is a function with
    /// no text — a host or hand-written one, with no EDAG, or one whose body
    /// the renderer cannot spell yet — whose conversion to a string is
    /// refused.
    fn static_function(
        code: StaticCode<Self>,
        length: u32,
        frame: Array<Self>,
        text: Option<&'static str>,
    ) -> Function<Self>;
    /// The frame `static_function` was given, read by the code through its `self_`.
    fn frame(self_: &Self::InternalFunction) -> &Array<Self>;
}
