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
        '        uint8_t const* Start;\n' +
        '        size_t Size;\n' +
        '    };\n' +
        '    struct ManagedStruct\n' +
        '    {\n' +
        '        ::com::ref<IMy> M;\n' +
        '    };\n' +
        '    class IMy : public ::com::IUnknown\n' +
        '    {\n' +
        '    public:\n' +
        '        constexpr static ::com::GUID const guid = ::com::GUID(0xC66FB2702D8049AD, 0xBB6E88C1F90B805D);\n' +
        '        virtual Slice COM_STDCALL GetSlice() const noexcept = 0;\n' +
        '        virtual void COM_STDCALL SetSlice(Slice slice) const noexcept = 0;\n' +
        '        virtual bool const* COM_STDCALL GetUnsafe() const noexcept = 0;\n' +
        '        virtual void COM_STDCALL SetUnsafe(Slice const* p, uint32_t size) const noexcept = 0;\n' +
        '        virtual bool COM_STDCALL Some(IMy const& p) const noexcept = 0;\n' +
        '        virtual IMy const* COM_STDCALL GetIMy_() const noexcept = 0;\n' +
        '        virtual void COM_STDCALL SetManagedStruct(ManagedStruct a) const noexcept = 0;\n' +
        '    };\n' +
        '}'
    if (cpp !== e) { throw cpp }
}

module.exports = f
