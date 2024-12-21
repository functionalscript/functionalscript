import cpp from './testlib.f.ts'

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
        '        ::nanocom::ref<IMy> M;\n' +
        '    };\n' +
        '    class IMy : public ::nanocom::IUnknown\n' +
        '    {\n' +
        '    public:\n' +
        '        constexpr static ::nanocom::GUID const guid = ::nanocom::GUID(0xC66FB2702D8049AD, 0xBB6E88C1F90B805D);\n' +
        '        virtual Slice GetSlice() const noexcept = 0;\n' +
        '        virtual void SetSlice(Slice slice) const noexcept = 0;\n' +
        '        virtual bool const* GetUnsafe() const noexcept = 0;\n' +
        '        virtual void SetUnsafe(Slice const* p, uint32_t size) const noexcept = 0;\n' +
        '        virtual bool Some(IMy const& p) const noexcept = 0;\n' +
        '        virtual IMy const* GetIMy_(uint16_t a, int16_t b) const noexcept = 0;\n' +
        '        ::nanocom::ref<IMy> GetIMy(uint16_t a, int16_t b) const noexcept\n' +
        '        {\n' +
        '            return ::nanocom::move_to_ref(GetIMy_(a, b));\n' +
        '        }\n' +
        '        virtual void SetManagedStruct(ManagedStruct a) const noexcept = 0;\n' +
        '    };\n' +
        '}'
    if (cpp() !== e) { throw cpp }
}

export default f
