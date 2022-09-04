use std::{sync::atomic::{AtomicU32, Ordering}, ptr::null};

use crate::{Class, Object, Ref, Vmt, iunknownvmt::IUnknownVmt, iunknown::IUnknown, hresult::HRESULT, Interface};

#[repr(C)]
pub struct CObject<T: Class> {
    vmt: &'static Vmt<T::Interface>,
    counter: AtomicU32,
    pub value: T,
}

impl<T: Class> CObject<T> {

    pub fn new(value: T) -> Ref<T::Interface> {
        let c = CObject {
            vmt: T::static_vmt(),
            counter: Default::default(),
            value,
        };
        let p = Box::into_raw(Box::new(c));
        unsafe { &*p }.to_interface().into()
    }

    pub fn to_interface(&self) -> &Object<T::Interface> {
        let p = self as *const Self as *const Object<T::Interface>;
        unsafe { &*p }
    }

    pub const IUNKNOWN: IUnknownVmt<T::Interface> = IUnknownVmt {
        QueryInterface: Self::QueryInterface,
        AddRef: Self::AddRef,
        Release: Self::Release,
    };

    #[allow(non_snake_case)]
    extern "stdcall" fn QueryInterface(
        this: &Object<T::Interface>,
        riid: &u128,
        ppv_object: &mut *const Object<IUnknown>,
    ) -> HRESULT {
        let (p, r) = if *riid == IUnknown::GUID || *riid == T::Interface::GUID {
            Self::AddRef(this);
            (this.to_iunknown() as *const Object<IUnknown>, HRESULT::S_OK)
        } else {
            (null(), HRESULT::E_NOINTERFACE)
        };
        *ppv_object = p;
        r
    }

    #[allow(non_snake_case)]
    extern "stdcall" fn AddRef(this: &Object<T::Interface>) -> u32 {
        unsafe { T::to_cobject(this) }.counter.fetch_add(1, Ordering::Relaxed) + 1
    }

    #[allow(non_snake_case)]
    extern "stdcall" fn Release(this: &Object<T::Interface>) -> u32 {
        let t = unsafe { T::to_cobject(this) };
        match t.counter.fetch_sub(1, Ordering::Relaxed) {
            1 => {
                let m = t as *const CObject<T> as *mut CObject<T>;
                unsafe { Box::from_raw(m) };
                0
            }
            x => x - 1,
        }
    }
}
