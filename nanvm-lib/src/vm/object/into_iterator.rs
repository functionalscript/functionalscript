use crate::vm::{IContainer, IVm, Object, Property, container_iterator::ContainerIterator};

impl<A: IVm> IntoIterator for Object<A> {
    type Item = Property<A>;
    type IntoIter = ContainerIterator<A, A::InternalObject>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}
