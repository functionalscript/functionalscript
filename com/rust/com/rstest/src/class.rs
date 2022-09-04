use std::sync::atomic::{AtomicU32, Ordering};

use crate::interface::{IUnknown, Interface, Object, Ref, Vmt, HRESULT, ULONG};

pub struct Data<T> {
    counter: AtomicU32,
    value: T,
}

pub trait Class: Sized + 'static {
    type Interface: Interface;
    type Internal: Interface + 'static;
    const INTERNAL: Self::Internal;
    fn vmt() -> CVmt<Self> {
        Vmt {
            QueryInterface,
            AddRef,
            Release,
            interface: Self::INTERNAL,
        }
    }
    fn static_vmt() -> &'static Vmt<Self::Internal, Data<Self>>;
    fn class_new(self) -> Ref<Self::Interface> {
        let c = CObject {
            vmt: Self::static_vmt(),
            data: Data {
                counter: AtomicU32::default(),
                value: self,
            },
        };
        let p = Box::into_raw(Box::new(c)) as *const Object<Self::Interface>;
        unsafe { &*p }.into()
    }
}

#[allow(non_snake_case)]
extern "stdcall" fn QueryInterface<T: Class>(
    this: &CObject<T>,
    riid: &u128,
    ppv_object: &mut *const Object<IUnknown>,
) -> HRESULT {
    if *riid == IUnknown::GUID || *riid == T::Interface::GUID {
        AddRef(this);
        *ppv_object = this as *const CObject<T> as *const Object<IUnknown>;
        HRESULT::S_OK
    } else {
        HRESULT::E_NOINTERFACE
    }
}

#[allow(non_snake_case)]
extern "stdcall" fn AddRef<T: Class>(this: &CObject<T>) -> ULONG {
    this.data.counter.fetch_add(1, Ordering::Relaxed) + 1
}

#[allow(non_snake_case)]
extern "stdcall" fn Release<T: Class>(this: &CObject<T>) -> ULONG {
    match this.data.counter.fetch_sub(1, Ordering::Relaxed) {
        1 => {
            let p = this as *const CObject<T> as *mut CObject<T>;
            unsafe { Box::from_raw(p) };
            0
        }
        x => x - 1,
    }
}

type CVmt<T: Class> = Vmt<T::Internal, Data<T>>;
type CObject<T: Class> = Object<T::Internal, Data<T>>;
