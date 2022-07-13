#ifndef COM_HPP
#define COM_HPP

#include <cstdint>

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
        virtual HRESULT __stdcall QueryInterface(GUID const &riid, IUnknown **const ppvObject) noexcept = 0;
        virtual ULONG __stdcall AddRef() noexcept = 0;
        virtual ULONG __stdcall Release() noexcept = 0;
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
