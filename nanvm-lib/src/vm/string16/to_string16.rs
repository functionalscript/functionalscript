use super::String16;
use crate::vm::{internal::IContainer, Any, IVm};

pub trait ToString16 {
    fn try_to_string16<A: IVm>(self) -> Result<String16<A>, Any<A>>
    where
        Self: Sized + IntoIterator<Item = Result<u16, Any<A>>>,
    {
        Ok(String16(A::InternalString16::new((), self)?))
    }
    fn to_string16<A: IVm>(self) -> String16<A>
    where
        Self: Sized + IntoIterator<Item = u16>,
    {
        self.into_iter().map(Ok).try_to_string16().unwrap()
    }
}

impl<T> ToString16 for T {}
