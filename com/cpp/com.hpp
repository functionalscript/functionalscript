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

static_assert(sizeof(bool) == 1);

namespace com
{
    constexpr uint64_t byteswap(uint64_t v) noexcept
    {
        v = v >>  8 & 0x00FF00FF00FF00FF |
            v <<  8 & 0xFF00FF00FF00FF00;
        v = v >> 16 & 0x0000FFFF0000FFFF |
            v << 16 & 0xFFFF0000FFFF0000;
        return v >> 32 | v << 32;
    }

    class GUID
    {
    public:
        uint64_t lo;
        uint64_t hi;
        constexpr GUID(uint64_t const lo, uint64_t const hi) noexcept
            : lo(lo << 48 & 0xFFFF'0000'0000'0000 |
                 lo << 16 & 0x0000'FFFF'0000'0000 |
                 lo >> 32),
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

    inline void guid_part(std::ostream &os, uint64_t const v)
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

    enum class HRESULT : uint32_t
    {
        S_OK = 0,
        E_NOINTERFACE = 0x80004002,
    };

    typedef uint32_t ULONG;

    typedef int32_t BOOL;

    class IUnknown{
        public :
            virtual HRESULT COM_STDCALL QueryInterface(GUID const &riid, IUnknown **const ppvObject) noexcept = 0;
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

        template<class U>
        ref<U> upcast() const noexcept
        {
            return ref<U>(p);
        }

        I* operator->() const noexcept
        {
            return &p;
        }

        I* unsafe_result() const noexcept
        {
            p.AddRef();
            return &p;
        }
    private:
        I &p;
    };

    template<class I>
    ref<I> to_ref(I& p) noexcept
    {
        return ref<I>(p);
    }

    constexpr static GUID const iunknown_guid =
        GUID(0x00000000'0000'0000, 0xC000'000000000046);

    template <class T>
    class implementation : public T
    {
    public:
        template<class ...U>
        static T* create_raw(U... u)
        {
            return new implementation(u...);
        }
        template<class ...U>
        static ref<T> create(U... u)
        {
            return to_ref(*create_raw(u...));
        }
    private:
        HRESULT COM_STDCALL QueryInterface(GUID const &riid, IUnknown **const ppvObject) noexcept override
        {
            if (riid != iunknown_guid && riid != T::guid)
            {
                return HRESULT::E_NOINTERFACE;
            }
            add_ref();
            *ppvObject = this;
            return HRESULT::S_OK;
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

        template<class ...U>
        explicit implementation(U... u): T(u...) {}

        std::atomic<ULONG> counter;
    };
}
