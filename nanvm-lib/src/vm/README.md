# VM

## Internal Traits

```rust
trait IContainer;
trait IInternalAny {
    type InternalString;
    // ...
}
```

## Types

Concrete types.

```rust
struct Any<T: IInternalAny>;
struct String<T: IInternalAny>;
// ...
```
