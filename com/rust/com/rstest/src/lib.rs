#[cfg(test)]
mod test {
    use com::{Object, Ref, Interface, GUID, Vmt, Class, CObject};

    struct IMy {
        a: unsafe extern "stdcall" fn(this: &Object<IMy>) -> Ref<IMy>,
        b: unsafe extern "stdcall" fn(this: &Object<IMy>) -> u32,
    }

    impl Interface for IMy {
        const GUID: GUID = 0x01234567_89AB_CDEF_0123_456789ABCDEF;
    }

    trait IMyClass: Class<Interface = IMy> {
        fn a(this: &CObject<Self>) -> Ref<IMy>;
        fn b(this: &CObject<Self>) -> u32;
        const INTERFACE_DEF: IMy = IMy { a: a::<Self>, b: b::<Self> };
    }

    extern "stdcall" fn a<T: IMyClass>(this: &Object<IMy>) -> Ref<IMy> {
        T::a(unsafe { T::to_cobject(this) })
    }
    extern "stdcall" fn b<T: IMyClass>(this: &Object<IMy>) -> u32 {
        T::b(unsafe { T::to_cobject(this) })
    }

    //

    struct X (u32);

    impl Class for X {
        type Interface = IMy;
        const INTERFACE: Self::Interface = X::INTERFACE_DEF;
        fn static_vmt() -> &'static Vmt<Self::Interface> {
            static V: Vmt<IMy> = X::VMT;
            &V
        }
    }

    impl IMyClass for X {
        fn a(this: &CObject<Self>) -> Ref<IMy> {
            this.to_interface().into()
        }
        fn b(this: &CObject<Self>) -> u32 {
            this.value.0
        }
    }
}
