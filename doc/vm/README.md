# VM

Two options:
- using instances
- using types. In this case, if we need multiple VMs in the same process, we need multiple types.

## Rust Interface

```rust
trait Any {
}

trait String {
}

trait Bigint {
}

trait Object {
}

trait Array {
}
```
