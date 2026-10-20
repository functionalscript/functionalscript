use core::ops::{AddAssign, Sub};

/// An unsigned index type: `u32`, the index of every VM container, and
/// `usize`, a slice's.
pub trait Uint:
    Sized + Copy + Default + PartialEq + AddAssign + Sub<Output = Self> + From<u8>
{
    /// The index as a `usize`, the type of an iterator's `size_hint`.
    fn to_usize(self) -> usize;
}

impl Uint for u32 {
    fn to_usize(self) -> usize {
        self as usize
    }
}

impl Uint for usize {
    fn to_usize(self) -> usize {
        self
    }
}
