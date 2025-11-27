use super::String;
use crate::vm::{internal::IContainer, Any, IVm};

pub trait ToString {
    fn try_to_string<A: IVm>(self) -> Result<String<A>, Any<A>>
    where
        Self: Sized + IntoIterator<Item = Result<u16, Any<A>>>,
    {
        Ok(String(A::InternalString::new((), self)?))
    }
    fn to_string<A: IVm>(self) -> String<A>
    where
        Self: Sized + IntoIterator<Item = u16>,
    {
        self.into_iter().map(Ok).try_to_string().unwrap()
    }
}

impl<T> ToString for T {}
