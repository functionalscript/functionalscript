use std::rc::Rc;

use crate::{
    naive::Naive,
    vm::{Any, Array, IComplex, IFunction, StaticCode},
};

/// What a `naive` function holds: its code, its `length`, and the frame it
/// captured.
struct StaticFunction {
    code: StaticCode<Naive>,
    length: u32,
    frame: Array<Naive>,
}

/// `naive`'s function value: an `Rc` over one object, so `Clone` is the
/// `Rc`'s and so is identity — every construction is a new object, and a
/// clone is the same one.
#[derive(Clone)]
pub struct Function(Rc<StaticFunction>);

impl Function {
    pub fn new(code: StaticCode<Naive>, length: u32, frame: Array<Naive>) -> Self {
        Function(Rc::new(StaticFunction {
            code,
            length,
            frame,
        }))
    }

    pub fn frame(&self) -> &Array<Naive> {
        &self.0.frame
    }
}

impl IComplex<Naive> for Function {
    fn ptr_eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.0, &other.0)
    }
}

impl IFunction<Naive> for Function {
    fn call(&self, args: Array<Naive>) -> Result<Any<Naive>, Any<Naive>> {
        (self.0.code)(self, args)
    }

    fn length(&self) -> u32 {
        self.0.length
    }
}
