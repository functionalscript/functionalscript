#pragma once

#include <cstdint>
#include <cstddef>
#include <atomic>
#include <iostream>

#if defined(__aarch64__) || defined(__amd64__)
#define COM_STDCALL
#elif defined(__clang__)
#define COM_STDCALL __attribute__((stdcall))
#else
#define COM_STDCALL __stdcall
#endif

namespace com
{
    constexpr uint64_t byteswap(uint64_t v)
    {
        v = ((v >>  8) & 0x00FF00FF00FF00FF) |
            ((v <<  8) & 0xFF00FF00FF00FF00);
        v = ((v >> 16) & 0x0000FFFF0000FFFF) |
            ((v << 16) & 0xFFFF0000FFFF0000);
        return (v >> 32) | (v << 32);
    }

    class GUID
    {
    public:
        uint64_t lo;
        uint64_t hi;
        constexpr GUID(uint64_t const lo, uint64_t const hi) noexcept
            : lo(((lo & 0xFFFF) << 48) | ((lo & 0xFFFF'0000) << 16) | (lo >> 32)),
              hi(byteswap(hi))
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

    inline void guid_part(std::ostream &os, uint64_t v)
    {
        for (int i = 64; i > 0;)
        {
            i -= 4;
            char const c = (v >> i) & 0xF;
            char const x = c < 10 ? c + '0' : c + ('A' - 10);
            os << x;
        }
    }

    inline std::ostream &operator<<(std::ostream &os, GUID const &self)
    {
        guid_part(os, self.lo);
        guid_part(os, self.hi);
        return os;
    }

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
        explicit ref(I &other) noexcept : p(other)
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
    private:
        HRESULT COM_STDCALL QueryInterface(GUID const &riid, IUnknown **const pvObject) noexcept override
        {
            if (riid != iunknown_guid && riid != T::guid)
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
