type IID = u128;

pub struct IUnknown {
    pub vmt: &'static IUnknownVmt,
}

type HRESULT = u32;
type ULONG = u32;

#[allow(non_snake_case)]
pub struct IUnknownVmt {
    pub QueryInterface: extern "stdcall" fn(
        this: &mut IUnknown,
        riid: &IID,
        ppvObject: &mut *mut IUnknown,
    ) -> HRESULT,
    pub AddRef: extern "stdcall" fn(this: &mut IUnknown) -> ULONG,
    pub Release: extern "stdcall" fn(this: &mut IUnknown) -> ULONG,
}

pub trait Interface {
    const IID: IID;
}