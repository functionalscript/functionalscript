use crate::{
    common::default::default,
    vm::{Any, IContainer, IInternalAny, Js, String16, Unpacked},
};

#[derive(Clone)]
pub struct Array<A: IInternalAny>(pub A::InternalArray);

impl<A: IInternalAny> Default for Array<A> {
    fn default() -> Self {
        Array(A::InternalArray::new_empty(()))
    }
}

impl<A: IInternalAny> PartialEq for Array<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for Array<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Array(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> std::fmt::Debug for Array<A> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.items_fmt('[', ']', f)
    }
}

impl<A: IInternalAny> Js<A> for Array<A> {
    fn string(&self) -> String16<A> {
        default()
    }
}
