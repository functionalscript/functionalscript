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

class Impl: com::implementation<My::IMy>
{
};

/*
DLL_EXPORT
extern "C" My::IMy* c_my_create()
{
    return new Impl();
}
*/
