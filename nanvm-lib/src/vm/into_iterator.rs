use crate::vm::{
    internal::{ContainerIterator, IContainer},
    Any, Array, IVm, Object, Property, String16,
};

impl<A: IVm> IntoIterator for Array<A> {
    type Item = Any<A>;
    type IntoIter = ContainerIterator<A, A::InternalArray>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}

impl<A: IVm> IntoIterator for Object<A> {
    type Item = Property<A>;
    type IntoIter = ContainerIterator<A, A::InternalObject>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}

impl<A: IVm> IntoIterator for String16<A> {
    type Item = u16;
    type IntoIter = ContainerIterator<A, A::InternalString16>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}
