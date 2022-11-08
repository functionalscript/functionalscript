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

class Impl: public My::IMy
{
public:
    My::Slice COM_STDCALL GetSlice() noexcept override
    {
    }
    void COM_STDCALL SetSlice(My::Slice slice) noexcept override
    {
        std::cout
            << "SetSlice: "
            << (slice.Start - static_cast<uint8_t*>(nullptr))
            << ", "
            << slice.Size
            << std::endl;
    }
    bool *COM_STDCALL GetUnsafe() noexcept override
    {
    }
    void COM_STDCALL SetUnsafe(My::Slice *p, uint32_t size) noexcept override
    {
    }
    bool COM_STDCALL Some(My::IMy &p) noexcept override
    {
    }
    My::IMy* COM_STDCALL GetIMy() noexcept override
    {
        return ::com::to_ref(*this).unsafe_result();
    }
    void COM_STDCALL SetManagedStruct(My::ManagedStruct a) noexcept override
    {
    }
    ~Impl()
    {
        ::std::cout << "done" << std::endl;
    }
};

DLL_EXPORT
extern "C" My::IMy* c_my_create()
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
