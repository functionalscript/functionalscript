use core::ops::{AddAssign, Index};

use crate::common::default::default;

pub trait SizedIndex<I>: Index<I> {
    fn length(&self) -> I;
    fn si_iter(self) -> SizedIndexIter<I, Self>
    where
        Self: Sized,
        I: Default,
    {
        SizedIndexIter::new(self)
    }
}

pub struct SizedIndexIter<I, T> {
    c: T,
    i: I,
}

impl<I: Default, T: SizedIndex<I>> SizedIndexIter<I, T> {
    pub fn new(c: T) -> Self {
        Self { c, i: default() }
    }
}

impl<I: Copy + Default + PartialEq + AddAssign + From<u8>, T: SizedIndex<I, Output: Clone>> Iterator
    for SizedIndexIter<I, T>
{
    type Item = T::Output;
    fn next(&mut self) -> Option<Self::Item> {
        let i = self.i;
        if i == self.c.length() {
            return None;
        }
        self.i += 1.into();
        Some(self.c[i].clone())
    }
}

impl<T> SizedIndex<usize> for [T] {
    fn length(&self) -> usize {
        self.len()
    }
}
