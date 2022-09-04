use std::{ptr::null, sync::atomic::Ordering};

use crate::{
    hresult::HRESULT, iunknown::IUnknown, iunknownvmt::IUnknownVmt, CObject, Interface, Object,
    Ref, Vmt,
};

pub trait Class: Sized {
    type Interface: Interface;
    fn static_vmt() -> &'static Vmt<Self::Interface>;
    const IUNKNOWN: IUnknownVmt<Self::Interface> = IUnknownVmt {
        QueryInterface: QueryInterface::<Self>,
        AddRef: AddRef::<Self>,
        Release: Release::<Self>,
    };
    fn c_new(self) -> Ref<Self::Interface> {
        let c = CObject {
            vmt: Self::static_vmt(),
            counter: Default::default(),
            value: self,
        };
        let p = Box::into_raw(Box::new(c));
        unsafe { &*p }.to_interface().into()
    }
    unsafe fn to_cobject(this: &Object<Self::Interface>) -> &CObject<Self> {
        let p = this as *const Object<Self::Interface> as *const CObject<Self>;
        &*p
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
        (this.to_iunknown() as *const Object<IUnknown>, HRESULT::S_OK)
    } else {
        (null(), HRESULT::E_NOINTERFACE)
    };
    *ppv_object = p;
    r
}

#[allow(non_snake_case)]
extern "stdcall" fn AddRef<T: Class>(this: &Object<T::Interface>) -> u32 {
    unsafe { T::to_cobject(this) }
        .counter
        .fetch_add(1, Ordering::Relaxed)
        + 1
}

#[allow(non_snake_case)]
extern "stdcall" fn Release<T: Class>(this: &Object<T::Interface>) -> u32 {
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
