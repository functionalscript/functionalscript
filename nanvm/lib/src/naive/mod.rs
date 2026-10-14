mod container;
mod function;

use std::cell::OnceCell;

use crate::{
    naive::{container::Container, function::Function},
    sign::Sign,
    vm::{Any, Array, IStaticFunction, IVm, Property, StaticCode, Unpacked},
};

thread_local! {
    /// The compiled runtime's object, evaluated on this thread's first
    /// lookup and held from then on, so every lookup answers a clone of one
    /// function and a body read twice is one function, as JavaScript's
    /// built-ins are. Per thread, since a value is an `Rc` and never leaves
    /// its thread; `None` where the module fails, which no lookup answers.
    /// `thread_local!` is the one stable spelling of a thread's own value.
    static RUNTIME: OnceCell<Option<Any<Naive>>> = const { OnceCell::new() };
}

/// The runtime object this thread holds, cloned out, since a reference
/// into a `thread_local` cannot leave `with`. Evaluating it runs no body
/// and asks for no binding, so its initialization never reaches back here,
/// which `get_or_init` would refuse with a panic.
fn runtime() -> Option<Any<Naive>> {
    RUNTIME.with(|cell| cell.get_or_init(crate::vm::runtime_object).clone())
}

/// Note: we can't use `type InternalAny = Unpacked<InternalAny>;` because Rust doesn't support
/// recursive type aliases.
#[derive(Clone)]
pub struct Naive(Unpacked<Naive>);

impl<T: Into<Unpacked<Naive>>> From<T> for Naive {
    fn from(value: T) -> Self {
        Naive(value.into())
    }
}

impl IVm for Naive {
    type InternalString = Container<(), u16>;
    type InternalBigInt = Container<Sign, u64>;
    type InternalObject = Container<(), Property<Naive>>;
    type InternalArray = Container<(), Any<Naive>>;
    type InternalFunction = Function;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }

    /// The compiled runtime's entry: `naive` makes a function out of a Rust
    /// static function, which every compiled body is, and holds the
    /// runtime object it reads, `runtime()`.
    fn runtime_method(type_name: &str, key: &Any<Naive>) -> Option<Any<Naive>> {
        crate::vm::runtime_method(runtime()?, type_name, key)
    }

    /// The compiled runtime's static entry, for the same reasons.
    fn runtime_static(path: &[&str]) -> Option<Any<Naive>> {
        crate::vm::runtime_static(runtime()?, path)
    }
}

/// `naive` holds a static function, and makes a function no other way.
impl IStaticFunction for Naive {
    fn static_function(
        code: StaticCode<Naive>,
        length: u32,
        frame: Array<Naive>,
        text: Option<&'static str>,
    ) -> crate::vm::Function<Naive> {
        crate::vm::Function::new(Function::new(code, length, frame, text))
    }

    fn frame(self_: &Function) -> &Array<Naive> {
        self_.frame()
    }
}
