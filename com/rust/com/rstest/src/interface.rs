use std::ptr::null_mut;

type IID = u128;

#[repr(C)]
pub struct Object<I: 'static, D: 'static = ()> {
    pub vmt: &'static Vmt<I, D>,
    pub data: D,
}

type HRESULT = u32;
type ULONG = u32;

const S_OK: HRESULT = 0;

#[allow(non_snake_case)]
#[repr(C)]
pub struct Vmt<I: 'static, D: 'static> {
    pub QueryInterface: extern "stdcall" fn(
        this: &mut Object<I, D>,
        riid: &IID,
        ppvObject: &mut *mut Object<I, D>,
    ) -> HRESULT,
    pub AddRef: extern "stdcall" fn(this: &mut Object<I, D>) -> ULONG,
    pub Release: extern "stdcall" fn(this: &mut Object<I, D>) -> ULONG,
    pub interface: I,
}

trait Interface {
    const GUID: IID;
}

struct IUnknown();

impl Interface for IUnknown {
    const GUID: IID = 0x00000000_0000_0000_C000_000000000046;
}

#[repr(transparent)]
pub struct Ref<I: 'static, D: 'static = ()>(*mut Object<I, D>);

impl<I, D> Ref<I, D> {
    fn this<'t>(&'t self) -> &'t mut Object<I, D> {
        unsafe { &mut  (*self.0) }
    }
    #[allow(non_snake_case)]
    fn QueryInterface<N: Interface>(&self) -> Option<Ref<N>> {
        let this = self.this();
        let mut p = null_mut();
        if (this.vmt.QueryInterface)(this, &N::GUID, &mut p) == S_OK {
            Some(Ref(p as *mut Object<N>))
        } else {
            None
        }
    }
}

impl<I, D> Drop for Ref<I, D> {
    fn drop(&mut self) {
        let this = self.this();
        (this.vmt.Release)(this);
    }
}

impl<I, D> Clone for Ref<I, D> {
    fn clone(&self) -> Self {
        let this = self.this();
        (this.vmt.AddRef)(this);
        Self(self.0)
    }
}
