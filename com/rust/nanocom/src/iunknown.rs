use crate::{hresult::HRESULT, Object, GUID};

#[allow(non_snake_case)]
#[repr(C)]
pub struct IUnknown<I: 'static> {
    pub QueryInterface: unsafe extern "stdcall" fn(
        this: &Object<I>,
        riid: &GUID,
        ppv_object: &mut *const Object,
    ) -> HRESULT,
    pub AddRef: unsafe extern "stdcall" fn(this: &Object<I>) -> u32,
    pub Release: unsafe extern "stdcall" fn(this: &Object<I>) -> u32,
}
