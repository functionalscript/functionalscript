#pragma once

#include <cstdint>
#include <cstddef>
#include <atomic>
#include <iostream>

#if defined(__aarch64__) || defined(__amd64__)
#define NANOCOM_STDCALL
#elif defined(__clang__)
#define NANOCOM_STDCALL __attribute__((stdcall))
#else
#define NANOCOM_STDCALL __stdcall
#endif

static_assert(sizeof(bool) == 1);

namespace nanocom
{
    constexpr uint64_t byteswap(uint64_t v) noexcept
    {
        v = v >> 8 & 0x00FF'00FF'00FF'00FF |
            v << 8 & 0xFF00'FF00'FF00'FF00;
        v = v >> 16 & 0x0000'FFFF'0000'FFFF |
            v << 16 & 0xFFFF'0000'FFFF'0000;
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

    constexpr inline char hex_digit(uint64_t const v, int const i) noexcept
    {
        char const c = v >> i & 0x0F;
        return c < 10 ? c + '0' : c + ('A' - 10);
    }

    inline void guid_part(std::ostream &os, uint64_t const v)
    {
        for (int i = 60; i >= 0; i -= 4)
        {
            os << hex_digit(v, i);
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

    class IUnknown
    {
    public:
        virtual HRESULT NANOCOM_STDCALL QueryInterface(GUID const &riid, IUnknown const **ppvObject) const noexcept = 0;
        virtual ULONG NANOCOM_STDCALL AddRef() const noexcept = 0;
        virtual ULONG NANOCOM_STDCALL Release() const noexcept = 0;
    };

    template <class I>
    class ref
    {
    public:
        explicit ref(I const &other) noexcept : p(other)
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

        template <class U>
        ref<U> upcast() const noexcept
        {
            return ref<U>(p);
        }

        I const *operator->() const noexcept
        {
            return &p;
        }

        I const *copy_to_raw() const noexcept
        {
            p.AddRef();
            return &p;
        }

        static ref move_to_ref(I const *const p)
        {
            return ref(p);
        }

    private:
        I const &p;
        ref(I const *const p) : p(*p) {}
    };

    template <class I>
    ref<I> move_to_ref(I const *const p)
    {
        return ref<I>::move_to_ref(p);
    }

    template <class I>
    ref<I> to_ref(I const &p) noexcept
    {
        return ref<I>(p);
    }

    constexpr static GUID const iunknown_guid =
        GUID(0x00000000'0000'0000, 0xC000'000000000046);

    template <class T>
    class implementation : public T
    {
    public:
        template <class... U>
        static ref<T> create(U... u)
        {
            T const *const p = new implementation(u...);
            return to_ref(*p);
        }

    private:
        HRESULT NANOCOM_STDCALL QueryInterface(GUID const &riid, IUnknown const **const ppvObject) const noexcept override
        {
            // std::cout << "riid:     " << riid << std::endl;
            // std::cout << "iunknown: " << iunknown_guid << std::endl;
            // std::cout << "T::guid:  " << T::guid << std::endl;
            // std::cout << std::endl;
            if (riid != iunknown_guid && riid != T::guid)
            {
                return HRESULT::E_NOINTERFACE;
            }
            add_ref();
            *ppvObject = this;
            return HRESULT::S_OK;
        }

        ULONG add_ref() const noexcept
        {
            return counter.fetch_add(1);
        }

        ULONG NANOCOM_STDCALL AddRef() const noexcept override
        {
            return add_ref() + 1;
        }

        ULONG NANOCOM_STDCALL Release() const noexcept override
        {
            auto const c = counter.fetch_sub(1) - 1;
            if (c == 0)
            {
                delete this;
            }
            return c;
        }

        template <class... U>
        explicit implementation(U... u) : T(u...) {}

        mutable std::atomic<ULONG> counter;
    };
}
