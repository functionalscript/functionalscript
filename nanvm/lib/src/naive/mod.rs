mod container;
mod function;
mod object;
mod string;

use crate::{
    naive::{
        container::Container,
        function::{Function, Text},
    },
    sign::Sign,
    vm::{Any, Array, IVm, StaticCode, Unpacked},
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
    type InternalString = string::String;
    type InternalBigInt = Container<Sign, u64>;
    type InternalObject = object::Object;
    type InternalArray = Container<(), Any<Naive>>;
    type InternalFunction = Function;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }

    fn with_unpacked<R>(&self, f: impl FnOnce(&Unpacked<Self>) -> R) -> R {
        f(&self.0)
    }

    /// Construct a runtime closure from static Rust code and its capture frame.
    fn static_function(
        code: StaticCode<Naive>,
        length: u32,
        frame: Array<Naive>,
        text: Option<&'static str>,
    ) -> crate::vm::Function<Naive> {
        crate::vm::Function::new(Function::new(code, length, frame, text.map(Text::Utf8)))
    }

    fn function_with_text(
        code: StaticCode<Self>,
        length: u32,
        frame: Array<Self>,
        text: Option<crate::vm::String<Self>>,
    ) -> crate::vm::Function<Self> {
        crate::vm::Function::new(Function::new(code, length, frame, text.map(Text::Vm)))
    }
    fn frame(self_: &Function) -> &Array<Naive> {
        self_.frame()
    }
}

use crate::vm::{IStaticVm, StaticArray, StaticBigInt, StaticFunction, StaticObject, StaticString};

impl IStaticVm for Naive {
    fn load_string(value: &'static StaticString) -> Self::InternalString {
        string::String::Static(value)
    }
    fn load_bigint(value: &'static StaticBigInt) -> Self::InternalBigInt {
        Container::borrowed(value.sign, value, value.words)
    }
    fn load_array(value: &'static StaticArray<Self>) -> Self::InternalArray {
        Container::array(value)
    }
    fn load_object(value: &'static StaticObject<Self>) -> Self::InternalObject {
        object::Object::Static(value)
    }
    fn load_function(value: &'static StaticFunction<Self>) -> Self::InternalFunction {
        Function::Static(value)
    }
}
