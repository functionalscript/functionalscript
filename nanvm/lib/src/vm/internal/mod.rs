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
    vm::{Any, Property, Unpacked},
};

/// A VM's value representation.
///
/// A VM is built from an [`Unpacked`] value alone, so a number reaches it
/// only as a [`Number`](crate::vm::Number), which holds one `NaN` by
/// construction — there is no `From<f64>` here on purpose — so a NaN-boxing
/// VM, which reads a negative quiet `NaN` as a boxed value, can store its
/// bits as they are.
pub trait IVm: Sized + Clone + From<Unpacked<Self>> {
    // types
    type InternalString: IContainer<Self, Header = (), Item = u16>;
    type InternalBigInt: IContainer<Self, Header = Sign, Item = u64>;
    type InternalObject: IContainer<Self, Header = (), Item = Property<Self>>;
    type InternalArray: IContainer<Self, Header = (), Item = Any<Self>>;
    type InternalFunction: IFunction<Self>;
    // functions
    fn to_unpacked(self) -> Unpacked<Self>;
    /// The member function the VM's runtime binds for a receiver of the
    /// type `type_name` names — `Object`, `Array`, `String`, `Number`,
    /// `Boolean`, `BigInt` or `Function`, the globals' names, as the
    /// `member` section of `fjs/js/runtime` keys them —
    /// and the key, or `None`. A call step asks it after the receiver's own
    /// property and the native table ([`method`](crate::vm::lambda) in
    /// `vm/lambda/method.rs`), and before the `TypeError` for calling
    /// `undefined`. The default binds nothing: a VM that makes functions
    /// out of Rust static functions answers it with
    /// [`runtime_method`](crate::vm::runtime_method), the compiled
    /// runtime's entry, over the [`runtime_object`](crate::vm::runtime_object)
    /// it holds, as `naive` does; a VM that cannot run a body leaves the
    /// default.
    fn runtime_method(type_name: &str, key: &Any<Self>) -> Option<Any<Self>> {
        let _ = (type_name, key);
        None
    }
    /// The static function the VM's runtime binds at `path`, the keys
    /// `fjs/js/static` admits it under — `["Object", "is"]` for
    /// `Object.is` — or `None`. A read of one asks it after the VM's own
    /// native binding of the path, if any. The default binds nothing; a VM
    /// that makes functions out of Rust static functions answers it with
    /// [`runtime_static`](crate::vm::runtime_static) over the runtime
    /// object it holds, as `naive` does: one object, so every read of a
    /// static function is one function.
    fn runtime_static(path: &[&str]) -> Option<Any<Self>> {
        let _ = path;
        None
    }
    /// The static function the VM binds natively at `path`, one no runtime
    /// body defines — `["Object", "entries"]` — or `None`. A read of one
    /// asks it before [`IVm::runtime_static`]. The default binds nothing; a
    /// VM that makes functions out of Rust static functions answers it with
    /// [`object_entries`](crate::vm::object_entries), holding what it
    /// answers, as `naive` does, so every read of a static function is one
    /// function.
    fn native_static(path: &[&str]) -> Option<Any<Self>> {
        let _ = path;
        None
    }
}
