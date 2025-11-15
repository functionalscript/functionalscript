use core::marker::PhantomData;

use crate::{
    common::sized_index::SizedIndex,
    vm::{IContainer, IVm},
};

pub struct ContainerIterator<A: IVm, C: IContainer<A>> {
    container: C,
    i: usize,
    _p: PhantomData<A>,
}

impl<A: IVm, C: IContainer<A>> ContainerIterator<A, C> {
    pub fn new(container: C) -> Self {
        Self {
            container,
            i: 0,
            _p: PhantomData,
        }
    }
}

impl<A: IVm, C: IContainer<A>> Iterator for ContainerIterator<A, C> {
    type Item = C::Item;
    fn next(&mut self) -> Option<Self::Item> {
        let i = self.i;
        let items = self.container.items();
        if i < items.length() {
            self.i += 1;
            Some(items[i].clone())
        } else {
            None
        }
    }
}
