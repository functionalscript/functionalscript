use crate::vm::{IObject, IVm, Object, Property};

impl<A: IVm> Object<A> {
    pub fn length(&self) -> u32 {
        self.0.length()
    }
    pub fn is_empty(&self) -> bool {
        self.length() == 0
    }
    pub(crate) fn key_at(&self, index: u32) -> crate::vm::String<A> {
        self.0.key_at(index)
    }
    /// Returns an owned property and panics if the index is out of bounds.
    pub fn property_at(&self, index: u32) -> Property<A> {
        self.0.property_at(index)
    }
}
