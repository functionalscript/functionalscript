use crate::vm::{Any, IComplex, IVm, Property, String};

/// Object storage with owned reads. A VM can decode a single property on demand.
pub trait IObject<A: IVm>: IComplex<A> + core::fmt::Debug {
    fn from_properties(properties: impl IntoIterator<Item = Property<A>>) -> Self;
    fn length(&self) -> u32;
    /// Panics for an out-of-bounds index.
    fn property_at(&self, index: u32) -> Property<A>;
    /// The last property written under this key.
    fn own_property(&self, key: &String<A>) -> Option<Any<A>>;
}
