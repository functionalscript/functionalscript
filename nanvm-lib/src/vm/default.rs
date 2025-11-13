use core::iter;

use crate::{
    sign::Sign,
    vm::{internal::IContainer, Array, BigInt, IVm, Object, String16, ToArray, ToString16},
};

impl<A: IVm> Default for Array<A> {
    fn default() -> Self {
        [].to_array()
    }
}

impl<A: IVm> Default for Object<A> {
    fn default() -> Self {
        Object(A::InternalObject::new_empty(()))
    }
}

impl<A: IVm> Default for BigInt<A> {
    fn default() -> Self {
        Self(A::InternalBigInt::new_empty(Sign::Positive))
    }
}

impl<A: IVm> Default for String16<A> {
    fn default() -> Self {
        iter::empty().to_string16()
    }
}
