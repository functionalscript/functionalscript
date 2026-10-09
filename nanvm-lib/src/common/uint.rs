use core::ops::{AddAssign, Sub};

pub trait Uint:
    Sized + Copy + Default + PartialEq + AddAssign + Sub<Output = Self> + From<u8>
{
}

impl<T: Sized + Copy + Default + PartialEq + AddAssign + Sub<Output = T> + From<u8>> Uint for T {}
