use std::rc::Rc;

use crate::{
    naive::Naive,
    vm::{Any, Array, IComplex, IFunction, StaticCode, StaticFunction},
};

/// What a `naive` function holds: its code, its `length`, the frame it
/// captured, and its text, where it has one.
struct Closure {
    descriptor: Option<&'static StaticFunction<Naive>>,
    code: StaticCode<Naive>,
    length: u32,
    frame: Array<Naive>,
    text: Option<&'static str>,
}

/// Dynamic closures use their allocation for identity. A loaded constant
/// uses its descriptor, including when loaded again with a fresh frame wrapper.
#[derive(Clone)]
pub struct Function(Rc<Closure>);

impl Function {
    pub fn new(
        code: StaticCode<Naive>,
        length: u32,
        frame: Array<Naive>,
        text: Option<&'static str>,
    ) -> Self {
        Function(Rc::new(Closure {
            descriptor: None,
            code,
            length,
            frame,
            text,
        }))
    }

    pub(super) fn from_static(value: &'static StaticFunction<Naive>) -> Self {
        Self(Rc::new(Closure {
            descriptor: Some(value),
            code: value.code,
            length: value.length,
            frame: Array::from_static(value.frame),
            text: value.text,
        }))
    }

    pub fn frame(&self) -> &Array<Naive> {
        &self.0.frame
    }
}

impl IComplex<Naive> for Function {
    fn ptr_eq(&self, other: &Self) -> bool {
        self.address() == other.address()
    }
    fn address(&self) -> usize {
        self.0.descriptor.map_or_else(
            || Rc::as_ptr(&self.0) as usize,
            |value| core::ptr::from_ref(value) as usize,
        )
    }
}

impl IFunction<Naive> for Function {
    fn call(&self, args: Array<Naive>) -> Result<Any<Naive>, Any<Naive>> {
        (self.0.code)(self, args)
    }

    fn length(&self) -> u32 {
        self.0.length
    }

    fn text(&self) -> Option<&'static str> {
        self.0.text
    }
}
