use core::ops::Index;

pub trait SizedIndex<I>: Index<I> {
    fn length(&self) -> I;
}

impl<T> SizedIndex<usize> for [T] {
    fn length(&self) -> usize {
        self.len()
    }
}
