# VM

## Internal Traits

```rust
trait IContainer;
trait IVm {
    type String;
    // ...
}
```

## Types

Concrete types.

```rust
struct Any<T: IVm>;
struct String<T: IVm>;
// ...
```

## ByteCode

Byte code is a VM agnostic.

```rust
trait Expression {}
struct NewString;
impl Expression for NewString {}
struct NewArray;
impl Expression for NewArray {}
// ...
```
