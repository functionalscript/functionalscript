use std::rc::Rc;

use crate::{
    naive::Naive,
    vm::{Any, Array, IComplex, IFunction, StaticCode, StaticFunction},
};

pub(super) enum Text {
    Utf8(&'static str),
    Vm(crate::vm::String<Naive>),
}

pub struct Closure {
    code: StaticCode<Naive>,
    length: u32,
    frame: Array<Naive>,
    text: Option<Text>,
}

/// A function's identity is the address of its descriptor or runtime closure.
#[derive(Clone)]
pub enum Function {
    Static(&'static StaticFunction<Naive>),
    Closure(Rc<Closure>),
}

impl Function {
    pub(super) fn new(
        code: StaticCode<Naive>,
        length: u32,
        frame: Array<Naive>,
        text: Option<Text>,
    ) -> Self {
        Self::Closure(Rc::new(Closure {
            code,
            length,
            frame,
            text,
        }))
    }

    pub fn frame(&self) -> &Array<Naive> {
        match self {
            Self::Static(_) => panic!("a static descriptor has no capture frame"),
            Self::Closure(closure) => &closure.frame,
        }
    }
}

impl IComplex<Naive> for Function {
    fn ptr_eq(&self, other: &Self) -> bool {
        self.address() == other.address()
    }
    fn address(&self) -> usize {
        match self {
            Self::Static(descriptor) => core::ptr::from_ref(*descriptor) as usize,
            Self::Closure(closure) => Rc::as_ptr(closure) as usize,
        }
    }
}

impl IFunction<Naive> for Function {
    fn call(&self, args: Array<Naive>) -> Result<Any<Naive>, Any<Naive>> {
        let code = match self {
            Self::Static(descriptor) => descriptor.code,
            Self::Closure(closure) => closure.code,
        };
        code(self, args)
    }

    fn length(&self) -> u32 {
        match self {
            Self::Static(descriptor) => descriptor.length,
            Self::Closure(closure) => closure.length,
        }
    }

    fn text(&self) -> Option<crate::vm::String<Naive>> {
        match self {
            Self::Static(descriptor) => descriptor.text.map(crate::vm::String::from_static),
            Self::Closure(closure) => closure.text.as_ref().map(|text| match text {
                Text::Utf8(s) => (*s).into(),
                Text::Vm(s) => s.clone(),
            }),
        }
    }
}
