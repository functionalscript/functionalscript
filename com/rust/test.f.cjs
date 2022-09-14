const { rust } = require('./module.f.cjs')
const { flat } = require('../../text/module.f.cjs')
const { join } = require('../../types/string/module.f.cjs')
const library = require('../types/testlib.f.cjs')

module.exports = {
    result: () => {
        const e =
            '#![allow(non_snake_case)]\n' +
            '#[repr(C)]\n' +
            'pub struct Slice {\n' +
            '    pub Start: *const u8,\n' +
            '    pub Size: usize,\n' +
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
            '        pub GetIMy: unsafe extern "system" fn(this: &Object) -> super::IMy::Ref,\n' +
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
            '        fn GetIMy(&self) -> super::IMy::Ref;\n' +
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
            '        fn GetIMy(&self) -> super::IMy::Ref {\n' +
            '            unsafe { (self.interface().GetIMy)(self) }\n' +
            '        }\n' +
            '    }\n' +
            '    pub trait ClassEx\n' +
            '    where\n' +
            '        Self: nanocom::Class<Interface = Interface>,\n' +
            '        nanocom::CObject<Self>: Ex,\n' +
            '    {\n' +
            '        const INTERFACE: Interface = Interface {\n' +
            '            GetSlice: Self::GetSlice,\n' +
            '            SetSlice: Self::SetSlice,\n' +
            '            GetUnsafe: Self::GetUnsafe,\n' +
            '            SetUnsafe: Self::SetUnsafe,\n' +
            '            Some: Self::Some,\n' +
            '            GetIMy: Self::GetIMy,\n' +
            '        };\n' +
            '    }\n' +
            '    impl<T: nanocom::Class<Interface = Interface>> ClassEx for T\n' +
            '    where\n' +
            '        nanocom::CObject<T>: Ex,\n' +
            '    {\n' +
            '    }\n' +
            '    trait PrivateClassEx\n' +
            '    where\n' +
            '        Self: nanocom::Class<Interface = Interface>,\n' +
            '        nanocom::CObject<Self>: Ex,\n' +
            '    {\n' +
            '        extern "system" fn GetSlice(this: &Object) -> super::Slice {\n' +
            '            unsafe { Self::to_cobject(this) }.GetSlice()\n' +
            '        }\n' +
            '        extern "system" fn SetSlice(this: &Object, slice: super::Slice) {\n' +
            '            unsafe { Self::to_cobject(this) }.SetSlice(slice)\n' +
            '        }\n' +
            '        extern "system" fn GetUnsafe(this: &Object) -> *const bool {\n' +
            '            unsafe { Self::to_cobject(this) }.GetUnsafe()\n' +
            '        }\n' +
            '        extern "system" fn SetUnsafe(this: &Object, p: *const super::Slice, size: u32) {\n' +
            '            unsafe { Self::to_cobject(this) }.SetUnsafe(p, size)\n' +
            '        }\n' +
            '        extern "system" fn Some(this: &Object, p: &super::IMy::Object) -> bool {\n' +
            '            unsafe { Self::to_cobject(this) }.Some(p)\n' +
            '        }\n' +
            '        extern "system" fn GetIMy(this: &Object) -> super::IMy::Ref {\n' +
            '            unsafe { Self::to_cobject(this) }.GetIMy()\n' +
            '        }\n' +
            '    }\n' +
            '    impl<T: nanocom::Class<Interface = Interface>> PrivateClassEx for T\n' +
            '    where\n' +
            '        nanocom::CObject<T>: Ex,\n' +
            '    {\n' +
            '    }\n' +
            '}'
        const r = join('\n')(flat('    ')(rust(library)))
        if (r !== e) { throw [e, r] }
        return r
    }
}