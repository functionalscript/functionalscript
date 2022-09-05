use crate::{hresult::HRESULT, iunknown::IUnknown, Object, GUID};

#[allow(non_snake_case)]
#[repr(C)]
pub struct IUnknownVmt<I: 'static> {
    pub QueryInterface: unsafe extern "stdcall" fn(
        this: &Object<I>,
        riid: &GUID,
        ppv_object: &mut *const Object<IUnknown>,
    ) -> HRESULT,
    pub AddRef: unsafe extern "stdcall" fn(this: &Object<I>) -> u32,
    pub Release: unsafe extern "stdcall" fn(this: &Object<I>) -> u32,
}
