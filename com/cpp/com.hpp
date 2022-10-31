#pragma once

#include <cstdint>
#include <cstddef>

#if defined(__aarch64__) || defined(__amd64__)
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

    static HRESULT const E_NOINTERFACE = 0x80004002;
    static HRESULT const S_OK = 0;

    typedef uint32_t ULONG;

    typedef int32_t BOOL;

    class IUnknown
    {
    public:
        virtual HRESULT COM_STDCALL QueryInterface(GUID const &riid, IUnknown **const ppvObject) noexcept = 0;
        virtual ULONG COM_STDCALL AddRef() noexcept = 0;
        virtual ULONG COM_STDCALL Release() noexcept = 0;
    };

    template<class I>
    class ref
    {
    public:
        explicit ref(I &other) noexcept : p(other.p)
        {
            p.AddRef();
        }
        ref(ref const &other) noexcept : ref(other.p)
        {
        }
        ~ref() noexcept
        {
            p.Release();
        }
    private:
        I &p;
    };

    template<class I>
    class implementation: public I
    {
        HRESULT COM_STDCALL QueryInterface(GUID const &riid, IUnknown **const ppvObject) noexcept override
        {
            return E_NOINTERFACE;
        }
        ULONG COM_STDCALL AddRef() noexcept override
        {
            return 0;
        }
        ULONG COM_STDCALL Release() noexcept override
        {
            return 0;
        }
    };
}
