# Load Time Relocation

## Types

For each value instance we need to provide a special type. For example,

```ts
const x = 'abc'
const y = [x, 5]
```

```rust
#[repr(C)]
struct X {
    length: u32,
    value: [u16; 3],
}
static X0: X = X {
    length: 3,
    value: [b'a' as u16, b'b' as u16, b'c' as u16],
};
#[repr(C)]
struct Y {
    length: u64,
    v0: &'static X,
    v1: u64,
}
static Y0: Y = Y {
    length: 2,
    v0: &X0, // < a load-time relocation should update the field
    v1: 5,
};
```

## Problem

Load time relocation of static pointers could be problematic using an existing tag-pointer structure because during the loading the required bits `0xfff?_????_????_????` will not be set.

It is a problem of the 64-bit NaN-pointer only. In a [128-bit value](./128bit.md), a static pointer is a plain field.

## Options

1. Run initialization process. It always works. It costs start-up time, and the static data is writable.
2. Change the tag so `0x000?_????_????_????` is a static pointer. We will not be able to set type bits. As is, it collides with numbers: these bits are small positive doubles. It works only if each double is stored with an offset, as in JavaScriptCore. That is another value layout.
3. Create a huge array `const X: [u64;N] = [...];` with static data and use an offset in this array instead of a pointer.
4. Let the relocation carry the tag as an addend. A linker can't `|` bits into a pointer, but it can add a constant. For an aligned 48-bit pointer, `+` and `|` give the same bits.
5. Static data is 128-bit, non-static is 64-bit.

### 3. Offsets

The static data has only numbers: no relocations, and nothing that depends on a platform.

- One layout for static and non-static containers.
- The array is read-only, with no initialization.
- It is position independent, so it can be a file: memory-mapped, cached, or shipped as data.
- It ports to other languages as an array of 64-bit numbers.

Costs:

- Each static access adds a base. It's an addition, not a load.
- Each module has its own array. A static reference needs a link step that merges the arrays, or a few bits for a module number.
- The generator assigns the offsets, not the compiler.
- In Rust, everything is `[u64; N]`: reading the `u16` data of a string needs an unsafe cast or shifts.
- A static reference is not a pointer. A real reference needs the base.

The index is in units of 8 bytes: a 32-bit index covers 32 GB and leaves payload bits for a type and a module number.

Functions: the array holds everything except code. If a function is data (bytecode), it is in the array. If a function is native code, the array holds an index into a function table, one table for a target, for example `static FUNCS: [fn(...); N]`. The table needs relocations, but these are plain code pointers, as in a vtable. The array then has a meaning only next to its binary.

### 4. Addend

```rust
// a static reference, type 4 (string): sign, exponent, type, ...10
const TAG: usize = 0xfff4_0000_0000_0002;

#[repr(transparent)]
struct Any(*const u8);
unsafe impl Sync for Any {}

#[repr(C)]
struct Y {
    length: u64,
    v0: Any,
    v1: u64,
}
static Y0: Y = Y {
    length: 2,
    v0: Any((&X0 as *const X as *const u8).wrapping_add(TAG)),
    v1: 5,
};
```

No initialization, no change of the layout, no run-time cost.

- Linux, x86-64, a position-independent executable, `rustc 1.97`: it works. The loaded value is `address | TAG` at each load address.
- Windows: not tested. A base relocation adds a delta to the stored 64 bits, so it should work.
- macOS: not tested, and it's a risk. A chained fixup packs the target into fewer bits, and bits `52..55` of the tag may not fit.
- 32-bit targets and `wasm32`: no problem at all. The pointer is one half of the value and the tag is another.

### 5. Static 128-bit

A static container holds pairs `(addend, payload)`, and reading an element is `payload + addend`. A number has the addend `0`, a reference has the tag.

- No pointer arithmetic in constants. The static data is read-only.
- Two layouts for each container: each access branches on static (the sign bit), and a static array can't be a slice of 64-bit values.
- The static data is twice as big.
- The conversion can't allocate, so a static element can only be a value that has a 64-bit form.

## Choice

Option 3 is the safest way to keep 64 bits: it depends on nothing outside of our code. Option 4 is an optimization for one binary on a platform where it is tested. Options 1 and 5 are fallbacks.
