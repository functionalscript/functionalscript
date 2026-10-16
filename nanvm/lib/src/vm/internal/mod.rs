mod iany;
mod icomplex;
mod icontainer;
mod ifunction;
mod istatic_function;

pub use iany::IAny;
pub use icomplex::IComplex;
pub use icontainer::IContainer;
pub use ifunction::IFunction;
pub use istatic_function::{IStaticFunction, StaticCode};

use crate::{
    sign::Sign,
    vm::{Any, Property},
};

/// A VM: the types its values are made of, and what it binds.
///
/// A VM is a type, with no instance yet: nothing here takes `self`. Its
/// values are its [`InternalAny`](IVm::InternalAny), an [`IAny`], which is
/// what [`Any<A>`](crate::vm::Any) wraps; `IVm` itself promises nothing of
/// `A`, not even `Clone`, so a type generic over `A: IVm` derives nothing
/// and writes its impls by hand over the fields that have them.
pub trait IVm: Sized {
    // types
    type InternalAny: IAny<Self>;
    type InternalString: IContainer<Self, Header = (), Item = u16>;
    type InternalBigInt: IContainer<Self, Header = Sign, Item = u64>;
    type InternalObject: IContainer<Self, Header = (), Item = Property<Self>>;
    type InternalArray: IContainer<Self, Header = (), Item = Any<Self>>;
    type InternalFunction: IFunction<Self>;
    // functions
    /// The member function the VM's runtime binds for a receiver of the
    /// type `type_name` names — `Object`, `Array`, `String`, `Number`,
    /// `Boolean`, `BigInt` or `Function`, the globals' names, as the
    /// `member` section of `fjs/js/runtime` keys them —
    /// and the key, or `None`. A call step asks it after the receiver's own
    /// property and the native table ([`method`](crate::vm::lambda) in
    /// `vm/lambda/method.rs`), and before the `TypeError` for calling
    /// `undefined`. The default binds nothing: a VM that makes functions
    /// out of Rust static functions answers it with the compiled runtime's
    /// entry, from the [`Runtime`](crate::vm::Runtime) it holds, as `naive`
    /// does; a VM that cannot run a body leaves the default.
    fn runtime_method(type_name: &str, key: &Any<Self>) -> Option<Any<Self>> {
        let _ = (type_name, key);
        None
    }
    /// The static function the VM's runtime binds at `path`, the keys
    /// `fjs/js/static` admits it under — `["Object", "is"]` for
    /// `Object.is` — or `None`: a generated body, or a function no body
    /// defines, `Object.entries`, which the runtime creates. The default
    /// binds nothing; a VM that makes functions out of Rust static
    /// functions answers it from the [`Runtime`](crate::vm::Runtime) it
    /// holds, as `naive` does: one runtime, so every read of a static
    /// function is one function.
    fn runtime_static(path: &[&str]) -> Option<Any<Self>> {
        let _ = path;
        None
    }
}
