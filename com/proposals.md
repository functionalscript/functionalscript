# Proposals For NanoCOM

## Pointer Types

- By ownership
  - direct reference/pointer. `&I`
  - cloneable wrapper. For example, `ref<I>`.
- By nullability
  - non-nullable, a reference. For example, `ref<I>`.
  - nullable, a pointer. For example, `ptr<I>`.
- By mutability
  - immutable. Multithreaded, with an atomic counter. The object can be mutable with synchronization mechanisms.
  - mutable. Single-threaded. With a simple counter and mutable.
- By value
  - interface. All functions are virtual. For example add_ref/release
  - implementation. Functions can be called directly, including add_ref/release.
  ```rust
  trait IUnknown {
    fn add_ref(self);
    fn release(self);
    fn query_interface<I>(self) -> ptr<I>;
  }
  // examples
  impl IUnknown for &IImmutableInterface { ... }
  impl IUnknown for &mut IMutableInterface { ... }
  impl IUnknown for &IImmutableInterfaceImplementation { ... }
  impl IUnknown for &mut IMutableInterfaceImplementation { ... }
  ```
