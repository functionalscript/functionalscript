use std::sync::atomic::AtomicU32;

use crate::{Class, Vmt};

#[repr(C)]
pub struct CObject<T: Class> {
    pub vmt: &'static Vmt<T::Interface>,
    pub counter: AtomicU32,
    pub value: T,
}
