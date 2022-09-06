const { rust } = require('./module.f.cjs')
const { flat } = require('../../text/module.f.cjs')
const { join } = require('../../types/string/module.f.cjs')
const library = require('../types/test.f.cjs')

{
    const e =
        '#![allow(non_snake_case)]\n' +
        '#[repr(C)]\n' +
        'pub struct Slice {\n' +
        '    pub Start: *const u8,\n' +
        '    pub Size: usize,\n' +
        '    pub M: IMy::Ref,\n' +
        '}\n' +
        'pub mod IMy {\n' +
        '    type Object = nanocom::Object<Interface>;\n' +
        '    type Ref = nanocom::Ref<Interface>;\n' +
        '    type Vmt = nanocom::Vmt<Interface>;\n' +
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
        '    pub trait ClassEx: nanocom::Class<Interface = Interface>\n' +
        '    where\n' +
        '        nanocom::CObject<Self>: Ex,\n' +
        '    {\n' +
        '        const INTERFACE: IMy = IMy {\n' +
        '            GetSlice: Self::GetSlice,\n' +
        '            SetSlice: Self::SetSlice,\n' +
        '            GetUnsafe: Self::GetUnsafe,\n' +
        '            SetUnsafe: Self::SetUnsafe,\n' +
        '            Some: Self::Some,\n' +
        '            GetIMy: Self::GetIMy,\n' +
        '        };\n' +
        '    }\n' +
        '}'
    const r = join('\n')(flat('    ')(rust(library)))
    if (r !== e) { throw [e, r] }
}

module.exports = {}