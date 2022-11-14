#include "../../cpp/nanocom.hpp"
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
    My::Slice GetSlice() const noexcept override
    {
    }
    void SetSlice(My::Slice slice) const noexcept override
    {
        std::cout
            << "SetSlice: "
            << (slice.Start - static_cast<uint8_t const *>(nullptr))
            << ", "
            << slice.Size
            << std::endl;
    }
    bool const *GetUnsafe() const noexcept override
    {
    }
    void SetUnsafe(My::Slice const *p, uint32_t size) const noexcept override
    {
    }
    bool Some(My::IMy const &p) const noexcept override
    {
    }
    My::IMy const *GetIMy_(uint16_t a, int16_t b) const noexcept override
    {
        return ::nanocom::to_ref(*this).copy_to_raw();
    }
    void SetManagedStruct(My::ManagedStruct a) const noexcept override
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
        auto const x = ::nanocom::implementation<Impl>::create().copy_to_raw();
        x->Release();
    }
    {
        auto const x = ::nanocom::implementation<Impl>::create().upcast<My::IMy>();
        x->SetSlice(My::Slice());
    }
    return ::nanocom::implementation<Impl>::create().copy_to_raw();
}
