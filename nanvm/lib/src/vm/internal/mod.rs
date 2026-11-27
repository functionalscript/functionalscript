mod icomplex;
mod icontainer;
mod ifunction;
mod iobject;
mod istatic_function;

pub use icomplex::IComplex;
pub use icontainer::IContainer;
pub use ifunction::IFunction;
pub use iobject::IObject;
pub use istatic_function::{GroupEntry, IStaticFunction, StaticCode};

use crate::{
    sign::Sign,
    vm::{Any, Array, Function, Unpacked},
};

/// A VM's value representation.
///
/// A VM is built from an [`Unpacked`] value alone, so a number reaches it
/// only as a [`Number`](crate::vm::Number), which holds one `NaN` by
/// construction — there is no `From<f64>` here on purpose — so a NaN-boxing
/// VM, which reads a negative quiet `NaN` as a boxed value, can store its
/// bits as they are.
///
/// A VM is `'static`: a type with no lifetime, which a function's text
/// names behind a `'static` reference. The runtime is not the VM's to
/// bind: it is a value, [`runtime`](crate::vm::runtime), built once by
/// whoever runs compiled modules and handed to each as its parameter, for
/// any VM.
pub trait IVm: Sized + Clone + From<Unpacked<Self>> + 'static {
    // types
    type InternalString: IContainer<Self, Header = (), Item = u16>;
    type InternalBigInt: IContainer<Self, Header = Sign, Item = u64>;
    type InternalObject: IObject<Self>;
    /// An array's items are also lent by reference, which `Array<A>`'s
    /// `a[i]` answers.
    type InternalArray: IContainer<
            Self,
            Header = (),
            Item = Any<Self>,
            Items: core::ops::Index<usize, Output = Any<Self>>,
        >;
    type InternalFunction: IFunction<Self>;
    // functions
    fn to_unpacked(self) -> Unpacked<Self>;

    /// Inspect the value without transferring ownership or cloning it.
    ///
    /// The view is valid only for the callback. A VM may borrow a stored
    /// `Unpacked` or decode a temporary view of a packed representation;
    /// callers cannot retain references to that view after the callback.
    /// Keep `to_unpacked` for operations that need the owned payload.
    ///
    /// ```compile_fail
    /// use nanvm_lib::{naive::Naive, vm::{IVm, Number, Unpacked}};
    /// let value = Naive::from(Unpacked::Number(Number::from(1.0)));
    /// let escaped = value.with_unpacked(|view| view);
    /// ```
    fn with_unpacked<R>(&self, f: impl FnOnce(&Unpacked<Self>) -> R) -> R;

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
    /// Bind a function whose source text is already a VM string.
    fn function_with_text(
        code: StaticCode<Self>,
        length: u32,
        frame: Array<Self>,
        text: Option<crate::vm::String<Self>>,
    ) -> Function<Self>;
    /// Make the members over one frame and return the first member as a handle.
    fn function_group<const S: usize, const N: usize>(
        frame: [Any<Self>; S],
        entries: [GroupEntry<Self>; N],
    ) -> Function<Self>;
    /// Select a member of the same group. Compiled code supplies an in-range index.
    fn group_member(self_: &Self::InternalFunction, index: usize) -> Function<Self>;
    /// The frame captured by a runtime closure or shared by its function group.
    /// A function loaded from a static descriptor reads its captures directly
    /// and returns an empty slice here.
    fn frame(self_: &Self::InternalFunction) -> &[Any<Self>];
}
