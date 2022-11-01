#pragma once

#include <cstdint>
#include <cstddef>
#include <atomic>

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
        uint64_t lo;
        uint64_t hi;
        constexpr GUID(uint64_t lo, uint64_t hi) noexcept : lo(lo),
                                                            hi(hi)
        {
        }
        constexpr bool operator==(GUID const b) const noexcept
        {
            return lo == b.lo && hi == b.hi;
        }
        constexpr bool operator!=(GUID const b) const noexcept
        {
            return !(*this == b);
        }
    };

    typedef uint32_t HRESULT;

    static HRESULT const E_NOINTERFACE = 0x80004002;
    static HRESULT const S_OK = 0;

    typedef uint32_t ULONG;

    typedef int32_t BOOL;

    class IUnknown
    {
    public:
        virtual HRESULT COM_STDCALL QueryInterface(GUID const &riid, IUnknown **const pvObject) noexcept = 0;
        virtual ULONG COM_STDCALL AddRef() noexcept = 0;
        virtual ULONG COM_STDCALL Release() noexcept = 0;
    };

    template <class I>
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

    constexpr static GUID const iunknown_guid =
        GUID(0x00000000'0000'0000, 0xC000'000000000046);

    template <class I>
    constexpr GUID interface_guid();

    template <class T>
    class implementation : public T
    {
        constexpr static GUID const guid = GUID(0, 0);
        HRESULT COM_STDCALL QueryInterface(GUID const &riid, IUnknown **const pvObject) noexcept override
        {
            if (riid != iunknown_guid && riid != guid)
            {
                return E_NOINTERFACE;
            }
            add_ref();
            *pvObject = this;
            return S_OK;
        }

        ULONG add_ref() noexcept
        {
            return counter.fetch_add(1);
        }

        ULONG COM_STDCALL AddRef() noexcept override
        {
            return add_ref() + 1;
        }

        ULONG COM_STDCALL Release() noexcept override
        {
            auto const c = counter.fetch_sub(1) - 1;
            if (c == 0)
            {
                delete this;
            }
            return c;
        }

        std::atomic<ULONG> counter;
    };
}
