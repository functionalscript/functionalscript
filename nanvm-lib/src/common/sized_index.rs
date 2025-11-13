use core::ops::Index;

pub trait SizedIndex<I>: Index<I> {
    fn length(&self) -> I;
}

impl<O> SizedIndex<usize> for [O] {
    fn length(&self) -> usize {
        self.len()
    }
}
