#![allow(non_snake_case)]

// interface definition:

mod library {
    pub mod IMy {
        pub type Object = nanocom::Object<Interface>;
        pub type Ref = nanocom::Ref<Interface>;
        pub type Vmt = nanocom::Vmt<Interface>;

        #[repr(C)]
        pub struct Interface {
            pub A: unsafe extern "system" fn(this: &Object) -> Ref,
            pub B: unsafe extern "system" fn(this: &Object) -> u32,
        }

        impl nanocom::Interface for Interface {
            const GUID: nanocom::GUID = 0x01234567_89AB_CDEF_0123_456789ABCDEF;
        }

        pub trait Ex {
            fn A(&self) -> Ref;
            fn B(&self) -> u32;
        }

        impl Ex for Object {
            fn A(&self) -> Ref {
                unsafe { (self.interface().A)(self) }
            }
            fn B(&self) -> u32 {
                unsafe { (self.interface().B)(self) }
            }
        }

        pub trait ClassEx: nanocom::Class<Interface = Interface>
        where
            nanocom::CObject<Self>: Ex,
        {
            const VMT: Vmt = Vmt {
                iunknown: Self::IUNKNOWN,
                interface: Interface {
                    A: Self::A,
                    B: Self::B,
                }
            };
        }

        impl<T: nanocom::Class<Interface = Interface>> ClassEx for T where nanocom::CObject<T>: Ex {}

        trait PrivateClassEx: nanocom::Class<Interface = Interface>
        where
            nanocom::CObject<Self>: Ex,
        {
            extern "system" fn A(this: &Object) -> Ref {
                unsafe { Self::to_cobject(this) }.A()
            }
            extern "system" fn B(this: &Object) -> u32 {
                unsafe { Self::to_cobject(this) }.B()
            }
        }

        impl<T: nanocom::Class<Interface = Interface>> PrivateClassEx for T where nanocom::CObject<T>: Ex {}
    }
}

// interface implementation
mod number {
    use nanocom::{CObject, Vmt};

    use crate::library::IMy::ClassEx;

    use super::library::IMy;

    pub struct X(pub u32);

    impl nanocom::Class for X {
        type Interface = IMy::Interface;
        fn static_vmt() -> &'static Vmt<Self::Interface> {
            static V: IMy::Vmt = X::VMT;
            &V
        }
    }

    impl IMy::Ex for CObject<X> {
        fn A(&self) -> IMy::Ref {
            self.to_interface().into()
        }
        fn B(&self) -> u32 {
            self.value.0
        }
    }
}

mod use_number {
    use nanocom::Class;

    use crate::library::IMy::Ex;

    use super::number::X;

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

    use nanocom::{CObject, Vmt};

    use crate::library::IMy::ClassEx;

    use super::library::IMy;

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

    impl nanocom::Class for X {
        type Interface = IMy::Interface;
        fn static_vmt() -> &'static Vmt<Self::Interface> {
            static V: IMy::Vmt = X::VMT;
            &V
        }
    }

    impl IMy::Ex for CObject<X> {
        fn A(&self) -> IMy::Ref {
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

    use crate::library::IMy::Ex;

    use super::destructor::X;

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
