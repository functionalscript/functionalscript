#[cfg(test)]
mod test {
    use com::{Object, Ref, Interface, GUID, Vmt, Class, CObject};

    struct IMy {
        a: extern "stdcall" fn(a: &Object<IMy>) -> Ref<IMy>
    }

    impl Interface for IMy {
        const GUID: GUID = 0x01234567_89AB_CDEF_0123_456789ABCDEF;
    }

    trait IMyClass: Class<Interface = IMy> {
        fn a(this: &CObject<Self>) -> Ref<IMy>;
        fn impl_vmt() -> IMy { IMy { a: Self::c_a } }
        extern "stdcall" fn c_a(this: &Object<IMy>) -> Ref<IMy> {
            let p = this as *const Object<IMy> as *const CObject<Self>;
            Self::a(unsafe { &*p })
        }
    }
}
