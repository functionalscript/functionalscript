mod container;
mod function;

use crate::{
    naive::{container::Container, function::Function},
    sign::Sign,
    vm::{Any, Array, IStaticFunction, IVm, Property, StaticCode, Unpacked},
};

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
}

/// `naive` holds a static function, and makes a function no other way.
impl IStaticFunction for Naive {
    fn static_function(
        code: StaticCode<Naive>,
        length: u32,
        frame: Array<Naive>,
    ) -> crate::vm::Function<Naive> {
        crate::vm::Function::new(Function::new(code, length, frame))
    }

    fn frame(self_: &Function) -> &Array<Naive> {
        self_.frame()
    }
}
