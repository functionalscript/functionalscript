use std::{ptr::null, sync::atomic::Ordering};

use crate::{hresult::HRESULT, iunknown::IUnknown, CObject, Interface, Object, Ref, Vmt};

pub trait Class: Sized {
    type Interface: Interface;
    const INTERFACE: Self::Interface;
    fn static_vmt() -> &'static Vmt<Self::Interface>;
    fn vmt() -> Vmt<Self::Interface> {
        Vmt {
            QueryInterface: QueryInterface::<Self>,
            AddRef: AddRef::<Self>,
            Release: Release::<Self>,
            interface: Self::INTERFACE,
        }
    }
    fn c_new(self) -> Ref<Self::Interface> {
        let c = CObject {
            vmt: Self::static_vmt(),
            counter: Default::default(),
            value: self,
        };
        let p = Box::into_raw(Box::new(c)) as *const Object<Self::Interface>;
        unsafe { Ref::from_raw(p) }
    }
}

#[allow(non_snake_case)]
extern "stdcall" fn QueryInterface<T: Class>(
    this: &Object<T::Interface>,
    riid: &u128,
    ppv_object: &mut *const Object<IUnknown>,
) -> HRESULT {
    let (p, r) = if *riid == IUnknown::GUID || *riid == T::Interface::GUID {
        AddRef::<T>(this);
        (
            this as *const Object<T::Interface> as *const Object<IUnknown>,
            HRESULT::S_OK,
        )
    } else {
        (null(), HRESULT::E_NOINTERFACE)
    };
    *ppv_object = p;
    r
}

#[allow(non_snake_case)]
extern "stdcall" fn AddRef<T: Class>(this: &Object<T::Interface>) -> u32 {
    let p = this as *const Object<T::Interface> as *const CObject<T>;
    unsafe { &*p }.counter.fetch_add(1, Ordering::Relaxed) + 1
}

#[allow(non_snake_case)]
extern "stdcall" fn Release<T: Class>(this: &Object<T::Interface>) -> u32 {
    let p = this as *const Object<T::Interface> as *const CObject<T>;
    let t = unsafe { &*p };
    match t.counter.fetch_sub(1, Ordering::Relaxed) {
        1 => {
            let m = p as *mut CObject<T>;
            unsafe { Box::from_raw(m) };
            0
        }
        x => x - 1,
    }
}
