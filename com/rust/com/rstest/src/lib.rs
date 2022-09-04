#[cfg(test)]
mod test {
    use com::{CObject, Class, Interface, Object, Ref, Vmt, GUID};

    // interface definition:

    #[repr(C)]
    struct IMy {
        pub a: unsafe extern "stdcall" fn(this: &Object<IMy>) -> Ref<IMy>,
        pub b: unsafe extern "stdcall" fn(this: &Object<IMy>) -> u32,
    }

    impl Interface for IMy {
        const GUID: GUID = 0x01234567_89AB_CDEF_0123_456789ABCDEF;
    }

    trait IMyEx {
        fn a(&self) -> Ref<IMy>;
        fn b(&self) -> u32;
    }

    impl IMyEx for Object<IMy> {
        fn a(&self) -> Ref<IMy> {
            unsafe { (self.vmt().interface.a)(self) }
        }
        fn b(&self) -> u32 {
            unsafe { (self.vmt().interface.b)(self) }
        }
    }

    trait IMyClass: Class<Interface = IMy>
    where
        CObject<Self>: IMyEx,
    {
        const INTERFACE: IMy = IMy {
            a: a::<Self>,
            b: b::<Self>,
        };
    }

    impl<T: Class<Interface = IMy>> IMyClass for T where CObject<T>: IMyEx {}

    extern "stdcall" fn a<T: IMyClass>(this: &Object<IMy>) -> Ref<IMy>
    where
        CObject<T>: IMyEx,
    {
        unsafe { T::to_cobject(this) }.a()
    }

    extern "stdcall" fn b<T: IMyClass>(this: &Object<IMy>) -> u32
    where
        CObject<T>: IMyEx,
    {
        unsafe { T::to_cobject(this) }.b()
    }

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

    impl IMyEx for CObject<X> {
        fn a(&self) -> Ref<IMy> {
            self.to_interface().into()
        }
        fn b(&self) -> u32 {
            self.value.0
        }
    }
}
