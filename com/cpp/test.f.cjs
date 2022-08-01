const _ = require('./module.f.cjs')
const library = require('../types/test.f.cjs')
const text = require('../../text/module.f.cjs')
const list = require('../../types/list/module.f.cjs')

const f = () =>
{
    const r = list.join('\n')(text.flat('    ')(_.cpp('My')(library)))
    const e = 
        'namespace My\n' +
        '{\n' +
        '    struct Slice\n' +
        '    {\n' +
        '        int* Start;\n' +
        '        size_t Size;\n' +
        '    };\n' +
        '    struct IMy: ::com::IUnknown\n' +
        '    {\n' +
        '        virtual int* COM_STDCALL GetSlice() = 0;\n' +
        '        virtual void COM_STDCALL SetSlice() = 0;\n' +
        '        virtual int* COM_STDCALL GetUnsafe() = 0;\n' +
        '        virtual void COM_STDCALL SetUnsafe() = 0;\n' +
        '        virtual ::com::BOOL COM_STDCALL Some() = 0;\n' +
        '    };\n' +
        '}'
    if (r !== e) { throw r }
    return r
}

module.exports = {
    /** @readonly */
    result: f()
}
