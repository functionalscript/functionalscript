const rust = require('./testlib.f.cjs')

module.exports = () => {
    const e =
        '#![allow(non_snake_case)]\n' +
        '#[repr(C)]\n' +
        'pub struct Slice {\n' +
        '    pub Start: *const u8,\n' +
        '    pub Size: usize,\n' +
        '}\n' +
        '#[repr(C)]\n' +
        'pub struct ManagedStruct {\n' +
        '    pub M: IMy::Ref,\n' +
        '}\n' +
        'pub mod IMy {\n' +
        '    pub type Object = nanocom::Object<Interface>;\n' +
        '    pub type Ref = nanocom::Ref<Interface>;\n' +
        '    pub type Vmt = nanocom::Vmt<Interface>;\n' +
        '    #[repr(C)]\n' +
        '    pub struct Interface {\n' +
        '        pub GetSlice: unsafe extern "system" fn(this: &Object) -> super::Slice,\n' +
        '        pub SetSlice: unsafe extern "system" fn(this: &Object, slice: super::Slice),\n' +
        '        pub GetUnsafe: unsafe extern "system" fn(this: &Object) -> *const bool,\n' +
        '        pub SetUnsafe: unsafe extern "system" fn(this: &Object, p: *const super::Slice, size: u32),\n' +
        '        pub Some: unsafe extern "system" fn(this: &Object, p: &super::IMy::Object) -> bool,\n' +
        '        pub GetIMy: unsafe extern "system" fn(this: &Object, a: u16, b: i16) -> super::IMy::Ref,\n' +
        '        pub SetManagedStruct: unsafe extern "system" fn(this: &Object, a: super::ManagedStruct),\n' +
        '    }\n' +
        '    impl nanocom::Interface for Interface {\n' +
        '        const GUID: nanocom::GUID = 0xC66FB270_2D80_49AD_BB6E_88C1F90B805D;\n' +
        '    }\n' +
        '    pub trait Ex {\n' +
        '        fn GetSlice(&self) -> super::Slice;\n' +
        '        fn SetSlice(&self, slice: super::Slice);\n' +
        '        fn GetUnsafe(&self) -> *const bool;\n' +
        '        fn SetUnsafe(&self, p: *const super::Slice, size: u32);\n' +
        '        fn Some(&self, p: &super::IMy::Object) -> bool;\n' +
        '        fn GetIMy(&self, a: u16, b: i16) -> super::IMy::Ref;\n' +
        '        fn SetManagedStruct(&self, a: super::ManagedStruct);\n' +
        '    }\n' +
        '    impl Ex for Object {\n' +
        '        fn GetSlice(&self) -> super::Slice {\n' +
        '            unsafe { (self.interface().GetSlice)(self) }\n' +
        '        }\n' +
        '        fn SetSlice(&self, slice: super::Slice) {\n' +
        '            unsafe { (self.interface().SetSlice)(self, slice) }\n' +
        '        }\n' +
        '        fn GetUnsafe(&self) -> *const bool {\n' +
        '            unsafe { (self.interface().GetUnsafe)(self) }\n' +
        '        }\n' +
        '        fn SetUnsafe(&self, p: *const super::Slice, size: u32) {\n' +
        '            unsafe { (self.interface().SetUnsafe)(self, p, size) }\n' +
        '        }\n' +
        '        fn Some(&self, p: &super::IMy::Object) -> bool {\n' +
        '            unsafe { (self.interface().Some)(self, p) }\n' +
        '        }\n' +
        '        fn GetIMy(&self, a: u16, b: i16) -> super::IMy::Ref {\n' +
        '            unsafe { (self.interface().GetIMy)(self, a, b) }\n' +
        '        }\n' +
        '        fn SetManagedStruct(&self, a: super::ManagedStruct) {\n' +
        '            unsafe { (self.interface().SetManagedStruct)(self, a) }\n' +
        '        }\n' +
        '    }\n' +
        '    pub trait ClassEx\n' +
        '    where\n' +
        '        Self: nanocom::Class<Interface = Interface>,\n' +
        '        nanocom::CObject<Self>: Ex,\n' +
        '    {\n' +
        '        const VMT: Vmt = Vmt {\n' +
        '            iunknown: nanocom::CObject::<Self>::IUNKNOWN,\n' +
        '            interface: Interface {\n' +
        '                GetSlice: Self::GetSlice,\n' +
        '                SetSlice: Self::SetSlice,\n' +
        '                GetUnsafe: Self::GetUnsafe,\n' +
        '                SetUnsafe: Self::SetUnsafe,\n' +
        '                Some: Self::Some,\n' +
        '                GetIMy: Self::GetIMy,\n' +
        '                SetManagedStruct: Self::SetManagedStruct,\n' +
        '            },\n' +
        '        };\n' +
        '    }\n' +
        '    impl<T> ClassEx for T\n' +
        '    where\n' +
        '        Self: nanocom::Class<Interface = Interface>,\n' +
        '        nanocom::CObject<Self>: Ex,\n' +
        '    {\n' +
        '    }\n' +
        '    trait PrivateClassEx\n' +
        '    where\n' +
        '        Self: nanocom::Class<Interface = Interface>,\n' +
        '        nanocom::CObject<Self>: Ex,\n' +
        '    {\n' +
        '        extern "system" fn GetSlice(this: &Object) -> super::Slice {\n' +
        '            unsafe { nanocom::CObject::from_object_unchecked(this) }.GetSlice()\n' +
        '        }\n' +
        '        extern "system" fn SetSlice(this: &Object, slice: super::Slice) {\n' +
        '            unsafe { nanocom::CObject::from_object_unchecked(this) }.SetSlice(slice)\n' +
        '        }\n' +
        '        extern "system" fn GetUnsafe(this: &Object) -> *const bool {\n' +
        '            unsafe { nanocom::CObject::from_object_unchecked(this) }.GetUnsafe()\n' +
        '        }\n' +
        '        extern "system" fn SetUnsafe(this: &Object, p: *const super::Slice, size: u32) {\n' +
        '            unsafe { nanocom::CObject::from_object_unchecked(this) }.SetUnsafe(p, size)\n' +
        '        }\n' +
        '        extern "system" fn Some(this: &Object, p: &super::IMy::Object) -> bool {\n' +
        '            unsafe { nanocom::CObject::from_object_unchecked(this) }.Some(p)\n' +
        '        }\n' +
        '        extern "system" fn GetIMy(this: &Object, a: u16, b: i16) -> super::IMy::Ref {\n' +
        '            unsafe { nanocom::CObject::from_object_unchecked(this) }.GetIMy(a, b)\n' +
        '        }\n' +
        '        extern "system" fn SetManagedStruct(this: &Object, a: super::ManagedStruct) {\n' +
        '            unsafe { nanocom::CObject::from_object_unchecked(this) }.SetManagedStruct(a)\n' +
        '        }\n' +
        '    }\n' +
        '    impl<T> PrivateClassEx for T\n' +
        '    where\n' +
        '        Self: nanocom::Class<Interface = Interface>,\n' +
        '        nanocom::CObject<Self>: Ex,\n' +
        '    {\n' +
        '    }\n' +
        '}'
    if (rust !== e) { throw rust }
}
