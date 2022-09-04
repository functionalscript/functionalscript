use std::sync::atomic::AtomicU32;

use crate::{Class, Vmt, Object};

#[repr(C)]
pub struct CObject<T: Class> {
    pub vmt: &'static Vmt<T::Interface>,
    pub counter: AtomicU32,
    pub value: T,
}

impl<T: Class> CObject<T> {
    pub fn to_interface(&self) -> &Object<T::Interface> {
        let p = self as *const Self as *const Object<T::Interface>;
        unsafe { &*p }
    }
}