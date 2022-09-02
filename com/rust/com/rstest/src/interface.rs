use std::{ops::Deref, ptr::null};

type IID = u128;

#[repr(C)]
pub struct Object<I: 'static, D: 'static = ()> {
    vmt: &'static Vmt<I, D>,
    data: D,
}

impl<I, D> Object<I, D> {
    #[allow(non_snake_case)]
    pub fn QueryInterface<J: Interface>(&self) -> Option<Ref<J>> {
        let mut p = null();
        if (self.vmt.QueryInterface)(self, &J::GUID, &mut p) == S_OK {
            Some(Ref(p as *const Object<J>))
        } else {
            None
        }
    }
}

type HRESULT = u32;
type ULONG = u32;

const S_OK: HRESULT = 0;

#[allow(non_snake_case)]
#[repr(C)]
pub struct Vmt<I: 'static, D: 'static> {
    pub QueryInterface: extern "stdcall" fn(
        this: &Object<I, D>,
        riid: &IID,
        ppvObject: &mut *const Object<I, D>,
    ) -> HRESULT,
    pub AddRef: extern "stdcall" fn(this: &Object<I, D>) -> ULONG,
    pub Release: extern "stdcall" fn(this: &Object<I, D>) -> ULONG,
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
        (self.vmt.Release)(self);
    }
}

impl<I, D> Clone for Ref<I, D> {
    fn clone(&self) -> Self {
        (self.vmt.AddRef)(self);
        Self(self.0)
    }
}
