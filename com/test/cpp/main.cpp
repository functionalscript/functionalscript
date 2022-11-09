#include "../../cpp/com.hpp"
#include "_result.hpp"

#ifdef _WIN32
#define DLL_EXPORT __declspec(dllexport)
#else
#define DLL_EXPORT
#endif

DLL_EXPORT
extern "C" int c_get()
{
    return 43;
}

class Impl : public My::IMy
{
public:
    My::Slice COM_STDCALL GetSlice() const noexcept override
    {
    }
    void COM_STDCALL SetSlice(My::Slice slice) const noexcept override
    {
        std::cout
            << "SetSlice: "
            << (slice.Start - static_cast<uint8_t const *>(nullptr))
            << ", "
            << slice.Size
            << std::endl;
    }
    bool const *COM_STDCALL GetUnsafe() const noexcept override
    {
    }
    void COM_STDCALL SetUnsafe(My::Slice const *p, uint32_t size) const noexcept override
    {
    }
    bool COM_STDCALL Some(My::IMy const &p) const noexcept override
    {
    }
    My::IMy const *COM_STDCALL GetIMy() const noexcept override
    {
        return ::com::to_ref(*this).unsafe_result();
    }
    void COM_STDCALL SetManagedStruct(My::ManagedStruct a) const noexcept override
    {
    }
    ~Impl()
    {
        ::std::cout << "done" << std::endl;
    }
};

DLL_EXPORT
extern "C" My::IMy const *c_my_create()
{
    {
        auto const x = ::com::implementation<Impl>::create().unsafe_result();
        x->Release();
    }
    {
        auto const x = ::com::implementation<Impl>::create().upcast<My::IMy>();
        x->SetSlice(My::Slice());
    }
    return ::com::implementation<Impl>::create().unsafe_result();
}
