#ifndef COM_HPP
#define COM_HPP

#include <cstdint>

#if defined(__aarch64__)
#define COM_STDCALL
#elif defined(__clang__)
#define COM_STDCALL __attribute__((stdcall))
#else
#define COM_STDCALL __stdcall
#endif

namespace com
{
    class GUID
    {
    public:
        uint64_t hi;
        uint64_t lo;
    };

    typedef uint32_t HRESULT;
    typedef uint32_t ULONG;

    class IUnknown
    {
    public:
        virtual HRESULT COM_STDCALL QueryInterface(GUID const &riid, IUnknown **const ppvObject) noexcept = 0;
        virtual ULONG COM_STDCALL AddRef() noexcept = 0;
        virtual ULONG COM_STDCALL Release() noexcept = 0;
    };

    template <class I>
    class Ref
    {
    public:
        explicit Ref(I &other) noexcept : p(other.p)
        {
            p.AddRef();
        }
        Ref(Ref const &other) noexcept : Ref(other.p)
        {
        }
        ~Ref() noexcept
        {
            p.Release();
        }

    private:
        I &p;
    };
}

#endif
