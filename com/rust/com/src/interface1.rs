use std::{ops::Deref, ptr::null};

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
