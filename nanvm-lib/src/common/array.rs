use super::default::default;

pub trait Array {
    const SIZE: usize;
    type Item: Default;
    fn as_slice(&self) -> &[Self::Item];
    fn as_mut_slice(&mut self) -> &mut [Self::Item];
    // We can't use `Default` here because it would require the array to be of
    // a type that implements `Default`.
    fn new() -> Self;
}

impl<T: Default + Copy, const SIZE: usize> Array for [T; SIZE] {
    const SIZE: usize = SIZE;
    type Item = T;
    fn as_slice(&self) -> &[T] {
        self
    }
    fn as_mut_slice(&mut self) -> &mut [T] {
        self
    }
    fn new() -> Self {
        [default(); SIZE]
    }
}
