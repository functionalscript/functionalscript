use std::{ops::Deref, ptr::null};

type IID = u128;

#[repr(C)]
pub struct Object<I: 'static, D: 'static = ()> {
    pub vmt: &'static Vmt<I, D>,
    pub data: D,
}

impl<I, D> Object<I, D> {
    pub fn query_interface<J: Interface>(&self) -> Result<Ref<J>, HRESULT> {
        let mut p = null();
        match (self.vmt.query_interface)(self, &J::GUID, &mut p) {
            S_OK => {
                let j = p as *const Object<J>;
                Ok(Ref(j))
            },
            e => Err(e)
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
pub const E_NOINTERFACE: HRESULT = 0x80004002;

#[repr(C)]
pub struct Vmt<I: 'static, D: 'static> {
    pub query_interface: extern "stdcall" fn(
        this: &Object<I, D>,
        riid: &IID,
        ppv_object: &mut *const Object<IUnknown>,
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
        (self.vmt.release)(self);
    }
}

impl<I> Clone for Ref<I> {
    fn clone(&self) -> Self {
        self.deref().into()
    }
}

impl<I> From<&Object<I>> for Ref<I> {
    fn from(this: &Object<I>) -> Self {
        (this.vmt.add_ref)(this);
        Self(this)
    }
}

#[cfg(test)]
mod tests {
    use super::{IUnknown, Interface, Object, Vmt, E_NOINTERFACE, HRESULT, IID, ULONG, S_OK};

    // interface

    #[repr(C)]
    struct ITest<D: 'static = ()> {
        get5: extern "stdcall" fn(this: &Object<ITest<D>, D>) -> u32,
    }
    impl Interface for ITest {
        const GUID: super::IID = 0x01234567_89AB_CDEF_0123_456789ABCDEF;
    }

    // implementation

    extern "stdcall" fn get5(this: &Object<ITest<u32>, u32>) -> u32 {
        this.data
    }

    extern "stdcall" fn query_interface(
        this: &Object<ITest<u32>, u32>,
        riid: &IID,
        ppv_object: &mut *const Object<IUnknown>,
    ) -> HRESULT {
        match *riid {
            IUnknown::GUID|ITest::GUID => {
                *ppv_object = this as *const Object<ITest<u32>, u32> as *const Object<IUnknown>;
                (this.vmt.add_ref)(this); // replace with non-virtual method
                S_OK
            }
            _ => E_NOINTERFACE
        }
    }

    extern "stdcall" fn add_ref(_this: &Object<ITest<u32>, u32>) -> ULONG {
        1
    }
    extern "stdcall" fn release(_this: &Object<ITest<u32>, u32>) -> ULONG {
        1
    }

    static VMT: Vmt<ITest<u32>, u32> = Vmt {
        query_interface,
        add_ref,
        release,
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
