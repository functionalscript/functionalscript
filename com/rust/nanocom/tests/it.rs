#![allow(non_snake_case)]

const x: u32 = 0;

// interface definition:

mod library {
    use nanocom::{CObject, Class, Interface, Object, Ref, GUID};


    #[repr(C)]
    pub struct IMy {
        pub A: unsafe extern "stdcall" fn(this: &Object<IMy>) -> Ref<IMy>,
        pub B: unsafe extern "stdcall" fn(this: &Object<IMy>) -> u32,
    }

    impl Interface for IMy {
        const GUID: GUID = 0x01234567_89AB_CDEF_0123_456789ABCDEF;
    }

    #[allow(non_snake_case)]
    pub trait IMyEx {
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

    pub trait IMyVmt: Class<Interface = IMy>
    where
        CObject<Self>: IMyEx,
    {
        const INTERFACE: IMy = IMy {
            A: Self::A,
            B: Self::B,
        };
    }

    impl<T: Class<Interface = IMy>> IMyVmt for T where CObject<T>: IMyEx {}

    #[allow(non_snake_case)]
    trait IMyVmtFn: Class<Interface = IMy>
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

    impl<T: Class<Interface = IMy>> IMyVmtFn for T where CObject<T>: IMyEx {}
}

// interface implementation
mod number {
    use nanocom::{CObject, Class, Ref, Vmt};

    use super::library::{IMy, IMyEx, IMyVmt};

    pub struct X(pub u32);

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

mod use_number {
    use nanocom::Class;

    use super::{library::IMyEx, number::X};

    #[test]
    fn test() {
        let a = X(42).cobject_new();
        let a1 = a.A();
        assert_eq!(a, a1);
        assert_eq!(a.B(), 42);
        let b = X(43).cobject_new();
        assert_ne!(a, b);
        assert_eq!(b.B(), 43);
    }
}

mod destructor {
    use std::{
        rc::Rc,
        sync::atomic::{AtomicU32, Ordering},
    };

    use nanocom::{CObject, Class, Ref, Vmt};

    use super::library::{IMy, IMyEx, IMyVmt};

    pub struct X {
        p: Rc<AtomicU32>,
    }

    impl X {
        pub fn new(p: Rc<AtomicU32>) -> Self {
            p.fetch_add(1, Ordering::Relaxed);
            Self { p }
        }
    }

    impl Drop for X {
        fn drop(&mut self) {
            self.p.fetch_sub(1, Ordering::Relaxed);
        }
    }

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
            self.value.p.load(Ordering::Relaxed)
        }
    }
}

mod use_destructor {
    use std::{
        rc::Rc,
        sync::atomic::{AtomicU32, Ordering},
    };

    use nanocom::Class;

    use super::{destructor::X, library::IMyEx};

    #[test]
    fn test() {
        let p = Rc::new(AtomicU32::default());
        {
            assert_eq!(p.load(Ordering::Relaxed), 0);
            let a = X::new(p.clone()).cobject_new();
            assert_eq!(p.load(Ordering::Relaxed), 1);
            let a1 = a.A();
            assert_eq!(p.load(Ordering::Relaxed), 1);
            assert_eq!(a, a1);
            assert_eq!(a.B(), 1);
            {
                let b = X::new(p.clone()).cobject_new();
                assert_eq!(p.load(Ordering::Relaxed), 2);
                assert_ne!(a, b);
                assert_eq!(b.B(), 2);
            }
            assert_eq!(p.load(Ordering::Relaxed), 1);
        }
        assert_eq!(p.load(Ordering::Relaxed), 0);
    }
}
