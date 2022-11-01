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

class Impl: public com::implementation<My::IMy>
{
    My::Slice COM_STDCALL GetSlice() noexcept override
    {
    }
    void COM_STDCALL SetSlice(My::Slice slice) noexcept override
    {
    }
    ::com::BOOL *COM_STDCALL GetUnsafe() noexcept override
    {
    }
    void COM_STDCALL SetUnsafe(My::Slice *p, uint32_t size) noexcept override
    {
    }
    ::com::BOOL COM_STDCALL Some(My::IMy &p) noexcept override
    {
    }
    ::com::ref<My::IMy> COM_STDCALL GetIMy() noexcept override
    {
    }
    void COM_STDCALL SetManagedStruct(My::ManagedStruct a) noexcept override
    {
    }
};

DLL_EXPORT
extern "C" My::IMy* c_my_create()
{
    return new Impl();
}
