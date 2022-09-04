use std::{ptr::null};
use crate::{vmt::Vmt, iunknown::IUnknown, interface::Interface, hresult::HRESULT, r#ref::Ref};

#[repr(C)]
pub struct Object<I: 'static>(&'static Vmt<I>);

impl<I> Object<I> {
    pub fn vmt(&self) -> &Vmt<I> {
        self.0
    }
    pub fn to_iunknown(&self) -> &Object<IUnknown> {
        let p = self as *const Object<I> as *const Object<IUnknown>;
        unsafe { &*p }
    }
    pub fn query_interface<J: Interface>(&self) -> Result<Ref<J>, HRESULT> {
        let mut p = null();
        match unsafe { (self.0.iunknown.QueryInterface)(self, &J::GUID, &mut p) } {
            HRESULT::S_OK => {
                let r = p as *const Object<J>;
                Ok(unsafe { Ref::from_raw(r) })
            },
            e => Err(e),
        }
    }
    pub fn query_iunknown(&self) -> Ref<IUnknown> {
        self.query_interface().unwrap()
    }
}