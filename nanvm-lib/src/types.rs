use crate::internal;

#[repr(transparent)]
pub struct Any<T: internal::Any> (pub T);
