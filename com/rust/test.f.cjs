const { rust } = require('./module.f.cjs')
const { flat } = require('../../text/module.f.cjs')
const { join } = require('../../types/string/module.f.cjs')
const library = require('../types/test.f.cjs')

{
    const e =
        '#[repr(C)]\n' +
        'pub struct Slice {\n' +
        '    Start: *const u8,\n' +
        '    Size: usize,\n' +
        '}\n' +
        '#[repr(C)]\n' +
        'pub struct IMy {\n' +
        '    GetSlice: extern "system" fn(this: &nanocom::Object),\n' +
        '    SetSlice: extern "system" fn(this: &nanocom::Object),\n' +
        '    GetUnsafe: extern "system" fn(this: &nanocom::Object),\n' +
        '    SetUnsafe: extern "system" fn(this: &nanocom::Object),\n' +
        '    Some: extern "system" fn(this: &nanocom::Object),\n' +
        '    GetIMy: extern "system" fn(this: &nanocom::Object),\n' +
        '}'
    const r = join('\n')(flat('    ')(rust(library)))
    if (r !== e) { throw [e, r] }
}

module.exports = {}