use std::{ops::Deref, ptr::null};

type IID = u128;

#[repr(C)]
pub struct Object<I: 'static, D: 'static = ()> {
    pub vmt: &'static Vmt<I, D>,
    pub data: D,
}

impl<I, D> Object<I, D> {
    pub fn query_interface<J: Interface>(&self) -> Option<Ref<J>> {
        let mut p = null();
        if (self.vmt.query_interface)(self, &J::GUID, &mut p) == S_OK {
            let j = p as *const Object<J>;
            Some(Ref(j))
        } else {
            None
        }
    }
    pub fn to_interface(&self) -> &Object<I> {
        let p = self as *const Object<I, D> as *const Object<I>;
        unsafe { &*p }
    }
    pub fn query_iunknown(&self) -> Ref<IUnknown> {
        self.query_interface().unwrap()
    }
}

type HRESULT = u32;
type ULONG = u32;

const S_OK: HRESULT = 0;

#[repr(C)]
pub struct Vmt<I: 'static, D: 'static> {
    pub query_interface: extern "stdcall" fn(
        this: &Object<I, D>,
        riid: &IID,
        ppvObject: &mut *const Object<IUnknown>,
    ) -> HRESULT,
    pub add_ref: extern "stdcall" fn(this: &Object<I, D>) -> ULONG,
    pub release: extern "stdcall" fn(this: &Object<I, D>) -> ULONG,
    pub interface: I,
}

pub trait Interface {
    const GUID: IID;
}

pub struct IUnknown();

impl Interface for IUnknown {
    const GUID: IID = 0x00000000_0000_0000_C000_000000000046;
}

#[repr(transparent)]
pub struct Ref<I: 'static, D: 'static = ()>(*const Object<I, D>);

impl<I, D> Deref for Ref<I, D> {
    type Target = Object<I, D>;
    fn deref(&self) -> &Self::Target {
        let p = self.0;
        unsafe { &*p }
    }
}

impl<I, D> Drop for Ref<I, D> {
    fn drop(&mut self) {
        (self.vmt.release)(self);
    }
}

impl<I, D> Clone for Ref<I, D> {
    fn clone(&self) -> Self {
        self.deref().into()
    }
}

impl<I, D> From<&Object<I, D>> for Ref<I, D> {
    fn from(this: &Object<I, D>) -> Self {
        (this.vmt.add_ref)(this);
        Self(this)
    }
}
