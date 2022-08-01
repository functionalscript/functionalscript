const types = require('../types/module.f.cjs')
const _ = require('./module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const text = require('../../text/module.f.cjs')
const library = require('../types/test.f.cjs')

const f = () =>
{
    const cs = list.join('\n')(text.flat('    ')(_.cs('My')(library)))
    const e =
        'using System;\n' +
        'using System.Runtime.InteropServices;\n' +
        '\n' +
        'namespace My\n' +
        '{\n' +
        '    [StructLayout(LayoutKind.Sequential)]\n' +
        '    public struct Slice\n' +
        '    {\n' +
        '        public unsafe byte* Start;\n' +
        '        public UIntPtr Size;\n' +
        '    }\n' +
        '    [Guid("C66FB270-2D80-49AD-BB6E-88C1F90B805D")]\n' +
        '    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]\n' +
        '    public interface IMy\n' +
        '    {\n' +
        '        [PreserveSig]\n' +
        '        Slice GetSlice();\n' +
        '        [PreserveSig]\n' +
        '        void SetSlice(Slice slice);\n' +
        '        [PreserveSig]\n' +
        '        unsafe bool* GetUnsafe();\n' +
        '        [PreserveSig]\n' +
        '        unsafe void SetUnsafe(Slice* p, uint size);\n' +
        '        [PreserveSig]\n' +
        '        bool Some(IMy p);\n' +
        '    }\n' +
        '}'
    if (cs !== e) { throw [cs,e] }
    return cs
}

const result = f()

module.exports = {
    /** @readonly */
    result,
}
