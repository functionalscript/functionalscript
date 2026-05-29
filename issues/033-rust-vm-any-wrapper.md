# 33. Rust: VM: implement `Any` and other types as wrappers.

```rust
struct Any<A: AnyPolicy>(A);
```

This way we can implement operations on it, such as `+`.
