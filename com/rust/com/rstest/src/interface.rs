use std::{ops::Deref, ptr::null};

pub type GUID = u128;

#[repr(C)]
pub struct Object<I: 'static, D: 'static = ()> {
    pub vmt: &'static Vmt<I, D>,
    pub data: D,
}

impl<I, D> Object<I, D> {
    pub fn to_iunknown(&self) -> &Object<IUnknown> {
        let p = self as *const Object<I, D> as *const Object<IUnknown>;
        unsafe { &*p }
    }
    pub fn query_interface<J: Interface>(&self) -> Result<Ref<J>, HRESULT> {
        let mut p = null();
        match (self.vmt.QueryInterface)(self, &J::GUID, &mut p) {
            S_OK => Ok(Ref(p as *const Object<J>)),
            e => Err(e),
        }
    }
    pub fn query_iunknown(&self) -> Ref<IUnknown> {
        self.query_interface().unwrap()
    }
}

#[allow(non_camel_case_types)]
#[repr(u32)]
#[derive(Debug)]
pub enum HRESULT {
    S_OK = 0,
    E_NOINTERFACE = 0x80004002,
}
pub type ULONG = u32;

#[allow(non_snake_case)]
#[repr(C)]
pub struct Vmt<I: 'static, D: 'static> {
    pub QueryInterface: extern "stdcall" fn(
        this: &Object<I, D>,
        riid: &GUID,
        ppv_object: &mut *const Object<IUnknown>,
    ) -> HRESULT,
    pub AddRef: extern "stdcall" fn(this: &Object<I, D>) -> ULONG,
    pub Release: extern "stdcall" fn(this: &Object<I, D>) -> ULONG,
    pub interface: I,
}

pub trait Interface {
    const GUID: GUID;
}

pub struct IUnknown();

impl Interface for IUnknown {
    const GUID: GUID = 0x00000000_0000_0000_C000_000000000046;
}

#[repr(transparent)]
pub struct Ref<I: 'static>(*const Object<I>);

impl<I> Deref for Ref<I> {
    type Target = Object<I>;
    fn deref(&self) -> &Self::Target {
        let p = self.0;
        unsafe { &*p }
    }
}

impl<I> Drop for Ref<I> {
    fn drop(&mut self) {
        (self.vmt.Release)(self);
    }
}

impl<I> Clone for Ref<I> {
    fn clone(&self) -> Self {
        self.deref().into()
    }
}

impl<I> From<&Object<I>> for Ref<I> {
    fn from(this: &Object<I>) -> Self {
        (this.vmt.AddRef)(this);
        Self(this)
    }
}

#[cfg(test)]
mod tests {
    use super::{IUnknown, Interface, Object, Vmt, GUID, HRESULT, ULONG};

    // interface

    #[repr(C)]
    struct ITest<D: 'static = ()> {
        get5: extern "stdcall" fn(this: &Object<ITest<D>, D>) -> u32,
    }
    impl Interface for ITest {
        const GUID: super::GUID = 0x01234567_89AB_CDEF_0123_456789ABCDEF;
    }

    // implementation

    extern "stdcall" fn get5(this: &Object<ITest<u32>, u32>) -> u32 {
        this.data
    }

    extern "stdcall" fn query_interface(
        this: &Object<ITest<u32>, u32>,
        riid: &GUID,
        ppv_object: &mut *const Object<IUnknown>,
    ) -> HRESULT {
        match *riid {
            IUnknown::GUID | ITest::GUID => {
                *ppv_object = this as *const Object<ITest<u32>, u32> as *const Object<IUnknown>;
                (this.vmt.AddRef)(this); // replace with non-virtual method
                HRESULT::S_OK
            }
            _ => HRESULT::E_NOINTERFACE,
        }
    }

    extern "stdcall" fn add_ref(_this: &Object<ITest<u32>, u32>) -> ULONG {
        1
    }
    extern "stdcall" fn release(_this: &Object<ITest<u32>, u32>) -> ULONG {
        1
    }

    static VMT: Vmt<ITest<u32>, u32> = Vmt {
        QueryInterface: query_interface,
        AddRef: add_ref,
        Release: release,
        interface: ITest { get5 },
    };

    #[test]
    fn check() {
        let o = Object {
            vmt: &VMT,
            data: 15,
        };
        let i = &o as *const Object<ITest<u32>, u32> as *const Object<ITest<()>>;
        let _p = unsafe { &*i };
    }
}
