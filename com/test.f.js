const _ = require('./main.f.js')
const list = require('../types/list/main.f.js')
const text = require('../text/main.f.js')

/** @type {_.Library} */
const library = {
    Slice: {
        struct: [
            ['Start', { '*': 'u8' }],
            ['Size', 'usize'],
        ]
    },
    IMy: {
        guid: 'C66FB270-2D80-49AD-BB6E-88C1F90B805D',
        interface: [
            ['GetSlice', [], ['Slice']],
            ['SetSlice', [['slice', ['Slice']]]],
        ],
    }
}

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
        '        public byte* Start;\n' +
        '        public UIntPtr Size;\n' +
        '    }\n' +
        '    [Guid("C66FB270-2D80-49AD-BB6E-88C1F90B805D")]\n' +
        '    [InterfaceType(ComInterfaceType.InterfaceIsUnknown)]\n' +
        '    public interface IMy\n' +
        '    {\n' +
        '        [PreserveSig]\n' +
        '        Slice GetSlice();\n' +
        '        [PreserveSig]\n' +
        '        void SetSlice(Slice slice);\n' +
        '    }\n' +
        '}'
    if (cs !== e) { throw [cs,e] }
}

module.exports = {}
