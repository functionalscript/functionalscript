use crate::common::default::default;

pub fn with_default<T: Default + Clone>(size: usize) -> Vec<T> {
    let mut vec = Vec::with_capacity(size);
    vec.resize(size, default());
    vec
}
