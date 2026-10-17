mod container;
mod function;

use std::cell::OnceCell;

use crate::{
    naive::{container::Container, function::Function},
    sign::Sign,
    vm::{Any, Array, IStaticFunction, IVm, Property, Runtime, StaticCode, Unpacked},
};

thread_local! {
    /// The runtime, initialized on this thread's first lookup and held
    /// from then on, so every lookup answers a clone of one function and a
    /// runtime function read twice, generated or created, is one function,
    /// as JavaScript's built-ins are. Per thread, since a value is an `Rc`
    /// and never leaves its thread. `thread_local!` is the one stable
    /// spelling of a thread's own value.
    static RUNTIME: OnceCell<Runtime<Naive>> = const { OnceCell::new() };
}

/// A lookup in the runtime this thread holds, since a reference into a
/// `thread_local` cannot leave `with`. Initializing it runs no body and
/// asks for no binding, so it never reaches back here, which `get_or_init`
/// would refuse with a panic.
fn runtime<T>(lookup: impl FnOnce(&Runtime<Naive>) -> T) -> T {
    RUNTIME.with(|cell| lookup(cell.get_or_init(Runtime::new)))
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

    /// The runtime's entry: `naive` makes a function out of a Rust static
    /// function, which every compiled body is, and holds the runtime it
    /// reads, `runtime`.
    fn runtime_method(type_name: &str, key: &Any<Naive>) -> Option<Any<Naive>> {
        runtime(|r| r.method(type_name, key))
    }

    /// The runtime's static function, for the same reasons: a body, or
    /// `Object.entries`, the built-in by its name, which the runtime
    /// answers a handle to and holds nowhere.
    fn runtime_static(path: &[&str]) -> Option<Any<Naive>> {
        runtime(|r| r.static_function(path))
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
