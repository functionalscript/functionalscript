# COM C++ library

## Example

### `nanocom` library

```cpp
class IUnknown
{
public:
    virtual HRESULT QueryInterface(GUID const &riid, IUnknown const **ppvObject) const noexcept = 0;
    virtual ULONG AddRef() const noexcept = 0;
    virtual ULONG Release() const noexcept = 0;
private:
    IUnknown(IUnknown const&);
};

template<class I>
class base: public I
{
public:
    HRESULT QueryInterface(GUID const &riid, IUnknown const **ppvObject) const noexcept override { ... }
    ULONG AddRef() const noexcept override { ... }
    ULONG Release() const noexcept override { ... }
};

template<class I, class T>
class impl;
```

### Generated

```cpp
class IAbc : public IUnknown
{
public:
    constexpr static GUID const guid = GUID(...);
    virtual IAbc* GetIAbc_() const noexcept = 0;
    ref<IAbc> GetIAbc() const noexcept
    {
        return move_to_ref(GetIAbc_());
    }
protected:
    IAbc() {}
};

template<class T>
class impl<IAbc, T> : public base<IAbc>
{
public:
    T value;
    IAbc* GetIAbc_() const noexcept override
    {
        return IAbc_GetIAbc(*this).copy_to_ref();
    }
    template <class... U>
    static ref<T> create(U... u)
    {
        T const *const p = new implementation(u...);
        return to_ref(*p);
    }
private:
    template <class... U>
    explicit implementation(U... u) : value(u...) {}
};
```

### Manually Written Code

```cpp
struct Abc {};

ref<IAbc> IAbc_GetIAbc(impl<IAbc, Abc> const & self)
{
    return to_ref(self);
}
```