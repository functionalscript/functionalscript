use core::ops::Index;

use crate::vm::{BigInt, IContainer, IVm};

impl<A: IVm> Index<u32> for BigInt<A> {
    type Output = u64;
    fn index(&self, index: u32) -> &Self::Output {
        self.0.items().index(index as usize)
    }
}
