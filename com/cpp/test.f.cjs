const cpp = require('./testlib.f.cjs')

const f = () =>
{
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
    if (cpp !== e) { throw cpp }
}

module.exports = {
    /** @readonly */
    result: f()
}
