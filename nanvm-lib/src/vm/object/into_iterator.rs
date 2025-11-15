use crate::vm::{container_iterator::ContainerIterator, IContainer, IVm, Object, Property};

impl<A: IVm> IntoIterator for Object<A> {
    type Item = Property<A>;
    type IntoIter = ContainerIterator<A, A::InternalObject>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}
