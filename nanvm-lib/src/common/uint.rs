use core::ops::Sub;

pub trait Uint: Sized + Copy + Default + PartialEq + Sub<Output = Self> + From<u8> {}

impl<T: Sized + Copy + Default + PartialEq + Sub<Output = T> + From<u8>> Uint for T {}
