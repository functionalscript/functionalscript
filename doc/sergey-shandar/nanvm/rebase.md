# Load Time Relocation

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
    v0: &x, // < a load-time relocation should update the field
    v1: 5,
}
```

## Problem

Load time relocation of static pointers could be problematic using an existing tag-pointer structure because during the loading the required bits `0xfff?_????_????_????` will not be set.

## Options

1. Run initialization process.
2. Change the tag so `0x000?_????_????_????` is a static pointer. We will not be able to set type bits.
3. Create a huge array `const X: [u64;N] = [...];` with static data and use an offset in this array instead of a pointer.
