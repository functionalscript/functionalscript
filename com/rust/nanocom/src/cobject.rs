use std::{
    ptr::null,
    sync::atomic::{AtomicU32, Ordering},
};

use crate::{guid::GuidEx, hresult::HRESULT, iunknown::IUnknown, Class, Object, Ref};

#[repr(C)]
pub struct CObject<T: Class> {
    object: Object<T::Interface>,
    counter: AtomicU32,
    pub value: T,
}

impl<T: Class> CObject<T> {
    pub const IUNKNOWN: IUnknown<T::Interface> = IUnknown {
        QueryInterface: Self::QueryInterface,
        AddRef: Self::AddRef,
        Release: Self::Release,
    };

    pub unsafe fn from_object_unchecked(this: &Object<T::Interface>) -> &CObject<T> {
        let p = this as *const Object<T::Interface> as *const CObject<T>;
        &*p
    }

    #[allow(non_snake_case)]
    extern "system" fn QueryInterface(
        this: &Object<T::Interface>,
        riid: &u128,
        ppv_object: &mut *const Object,
    ) -> HRESULT {
        let (p, r) = if *riid == <()>::PLATFORM_GUID || *riid == T::Interface::PLATFORM_GUID {
            Self::AddRef(this);
            (this.to_iunknown() as *const Object, HRESULT::S_OK)
        } else {
            (null(), HRESULT::E_NOINTERFACE)
        };
        *ppv_object = p;
        r
    }

    #[allow(non_snake_case)]
    extern "system" fn AddRef(this: &Object<T::Interface>) -> u32 {
        unsafe { Self::from_object_unchecked(this) }
            .counter
            .fetch_add(1, Ordering::Relaxed)
            + 1
    }

    #[allow(non_snake_case)]
    extern "system" fn Release(this: &Object<T::Interface>) -> u32 {
        let t = unsafe { Self::from_object_unchecked(this) };
        match t.counter.fetch_sub(1, Ordering::Relaxed) {
            1 => {
                let m = t as *const CObject<T> as *mut CObject<T>;
                let _ = unsafe { Box::from_raw(m) };
                0
            }
            x => x - 1,
        }
    }
}

pub trait CObjectEx: Class {
    fn to_cobject(self) -> Ref<Self::Interface> {
        let c = CObject {
            object: Object::new(Self::static_vmt()),
            counter: Default::default(),
            value: self,
        };
        let p = Box::into_raw(Box::new(c));
        let o = &unsafe { &*p }.object;
        o.into()
    }
}

impl<T: Class> CObjectEx for T {}

impl<'a, T: Class> From<&'a CObject<T>> for &'a Object<T::Interface> {
    fn from(this: &'a CObject<T>) -> Self {
        &this.object
    }
}

impl<T: Class> From<&CObject<T>> for Ref<T::Interface> {
    fn from(this: &CObject<T>) -> Self {
        (&this.object).into()
    }
}
