use crate::vm::{IContainer, IVm, String16, container_iterator::ContainerIterator};

impl<A: IVm> IntoIterator for String16<A> {
    type Item = u16;
    type IntoIter = ContainerIterator<A, A::InternalString16>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}
