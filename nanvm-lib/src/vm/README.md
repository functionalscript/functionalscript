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
