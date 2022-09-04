use crate::{guid::GUID, hresult::HRESULT, iunknown::IUnknown, object::Object};

#[allow(non_snake_case)]
#[repr(C)]
pub struct Vmt<I: 'static> {
    pub QueryInterface: unsafe extern "stdcall" fn(
        this: &Object<I>,
        riid: &GUID,
        ppv_object: &mut *const Object<IUnknown>,
    ) -> HRESULT,
    pub AddRef: unsafe extern "stdcall" fn(this: &Object<I>) -> u32,
    pub Release: unsafe extern "stdcall" fn(this: &Object<I>) -> u32,
    pub interface: I,
}
