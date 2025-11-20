mod debug;
mod partial_eq;
mod serializable;

pub mod header;

use crate::vm::{IContainer, IVm, String};

// TODO: remove `pub` from the field when bytecode generator is implemented.
#[derive(Clone)]
pub struct Function<A: IVm>(pub A::InternalFunction);

impl<A: IVm> Function<A> {
    pub fn name(&self) -> &String<A> {
        &self.0.header().0
    }
    pub fn length(&self) -> u32 {
        self.0.header().1
    }
}
