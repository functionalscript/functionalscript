#[cfg(test)]
mod test {
    use com::{CObject, Class, Interface, Object, Ref, Vmt, GUID};

    // interface definition:

    #[allow(non_snake_case)]
    #[repr(C)]
    struct IMy {
        pub A: unsafe extern "stdcall" fn(this: &Object<IMy>) -> Ref<IMy>,
        pub B: unsafe extern "stdcall" fn(this: &Object<IMy>) -> u32,
    }

    impl Interface for IMy {
        const GUID: GUID = 0x01234567_89AB_CDEF_0123_456789ABCDEF;
    }

    #[allow(non_snake_case)]
    trait IMyEx {
        fn A(&self) -> Ref<IMy>;
        fn B(&self) -> u32;
    }

    #[allow(non_snake_case)]
    impl IMyEx for Object<IMy> {
        fn A(&self) -> Ref<IMy> {
            unsafe { (self.interface().A)(self) }
        }
        fn B(&self) -> u32 {
            unsafe { (self.interface().B)(self) }
        }
    }

    trait IMyClass: Class<Interface = IMy>
    where
        CObject<Self>: IMyEx,
    {
        const INTERFACE: IMy = IMy {
            A: Self::A,
            B: Self::B,
        };
    }

    impl<T: Class<Interface = IMy>> IMyClass for T where CObject<T>: IMyEx {}

    #[allow(non_snake_case)]
    trait IMyImpl: Class<Interface = IMy>
    where
        CObject<Self>: IMyEx,
    {
        extern "stdcall" fn A(this: &Object<IMy>) -> Ref<IMy> {
            unsafe { Self::to_cobject(this) }.A()
        }
        extern "stdcall" fn B(this: &Object<IMy>) -> u32 {
            unsafe { Self::to_cobject(this) }.B()
        }
    }

    impl<T: Class<Interface = IMy>> IMyImpl for T where CObject<T>: IMyEx {}

    // interface implementation

    struct X(u32);

    impl Class for X {
        type Interface = IMy;
        fn static_vmt() -> &'static Vmt<Self::Interface> {
            static V: Vmt<IMy> = Vmt {
                iunknown: X::IUNKNOWN,
                interface: X::INTERFACE,
            };
            &V
        }
    }

    #[allow(non_snake_case)]
    impl IMyEx for CObject<X> {
        fn A(&self) -> Ref<IMy> {
            self.to_interface().into()
        }
        fn B(&self) -> u32 {
            self.value.0
        }
    }
}
