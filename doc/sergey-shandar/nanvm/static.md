# Linking Problem

Linking static objects could be problematic using an existing tag-pointer structure because during loading, a linker will not set required bits.

## Types

For each value instance we need to provide a special type. For example,

```ts
const x = 'abc'
const y = [x, 5]
```

```rust
#repr(c)
struct X {
    length: u32,
    value: [3; u16],
}
const x: X = X {
    length: 3,
    value: [b'a' as u16, b'b' as u16, b'c' as u16],
}
#repr(c)
struct Y {
    length: u64,
    v0: &'static X,
    v1: u64,
}
const y: Y = Y {
    length: 2,
    v0: &x, // < a linker should update the field
    v1: 5,
}
```
