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
        '}\n' +
        '#[repr(C)]\n' +
        'pub struct IMy {\n' +
        '    pub GetSlice: unsafe extern "system" fn(this: &nanocom::Object<IMy>) -> Slice,\n' +
        '    pub SetSlice: unsafe extern "system" fn(this: &nanocom::Object<IMy>, slice: Slice),\n' +
        '    pub GetUnsafe: unsafe extern "system" fn(this: &nanocom::Object<IMy>) -> *const bool,\n' +
        '    pub SetUnsafe: unsafe extern "system" fn(this: &nanocom::Object<IMy>, p: *const Slice, size: u32),\n' +
        '    pub Some: unsafe extern "system" fn(this: &nanocom::Object<IMy>, p: &nanocom::Object<IMy>) -> bool,\n' +
        '    pub GetIMy: unsafe extern "system" fn(this: &nanocom::Object<IMy>) -> nanocom::Ref<IMy>,\n' +
        '}\n' +
        'impl nanocom::Interface for IMy {\n' +
        '    const GUID: nanocom::GUID = 0xC66FB270_2D80_49AD_BB6E_88C1F90B805D;\n' +
        '}\n' +
        'pub trait IMyEx {\n' +
        '    fn GetSlice(&self) -> Slice;\n' +
        '    fn SetSlice(&self, slice: Slice);\n' +
        '    fn GetUnsafe(&self) -> *const bool;\n' +
        '    fn SetUnsafe(&self, p: *const Slice, size: u32);\n' +
        '    fn Some(&self, p: &nanocom::Object<IMy>) -> bool;\n' +
        '    fn GetIMy(&self) -> nanocom::Ref<IMy>;\n' +
        '}'
    const r = join('\n')(flat('    ')(rust(library)))
    if (r !== e) { throw [e, r] }
}

module.exports = {}