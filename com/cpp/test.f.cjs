const _ = require('./module.f.cjs')
const library = require('../types/testlib.f.cjs')
const text = require('../../text/module.f.cjs')
const { join } = require('../../types/module.f.cjs').string

const f = () =>
{
    const r = join('\n')(text.flat('    ')(_.cpp('My')(library)))
    const e =
        '#pragma once\n' +
        '\n' +
        'namespace My\n' +
        '{\n' +
        '    struct Slice;\n' +
        '    struct ManagedStruct;\n' +
        '    struct IMy;\n' +
        '    struct Slice\n' +
        '    {\n' +
        '        uint8_t* Start;\n' +
        '        size_t Size;\n' +
        '    };\n' +
        '    struct ManagedStruct\n' +
        '    {\n' +
        '        ::com::ref<IMy> M;\n' +
        '    };\n' +
        '    struct IMy: ::com::IUnknown\n' +
        '    {\n' +
        '        virtual Slice COM_STDCALL GetSlice() = 0;\n' +
        '        virtual void COM_STDCALL SetSlice(Slice slice) = 0;\n' +
        '        virtual ::com::BOOL* COM_STDCALL GetUnsafe() = 0;\n' +
        '        virtual void COM_STDCALL SetUnsafe(Slice* p, uint32_t size) = 0;\n' +
        '        virtual ::com::BOOL COM_STDCALL Some(IMy& p) = 0;\n' +
        '        virtual ::com::ref<IMy> COM_STDCALL GetIMy() = 0;\n' +
        '        virtual void COM_STDCALL SetManagedStruct(ManagedStruct a) = 0;\n' +
        '    };\n' +
        '}'
    if (r !== e) { throw r }
    return r
}

module.exports = {
    /** @readonly */
    result: f()
}
