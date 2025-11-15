use crate::vm::{
    Any, Array, IVm, container_iterator::ContainerIterator, internal::IContainer
};

impl<A: IVm> IntoIterator for Array<A> {
    type Item = Any<A>;
    type IntoIter = ContainerIterator<A, A::InternalArray>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}
