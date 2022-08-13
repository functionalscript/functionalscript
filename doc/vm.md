# VM

[Tagged Pointer](https://en.wikipedia.org/wiki/Tagged_pointer).

## Common (3 bit)

- `false`
- `true`
- `undefined`
- `""`
- `+infinity`
- `-infinity`
- `-0`
- `NaN`

## 6-bit Id String

|symbol  |code          |# |sum|
|--------|--------------|--|---|
|`$`     |`\x24`        | 1|  1|
|`0`..`9`|`\x30`..`\x39`| A|  B|
|`A`..`Z`|`\x41`..`\x5A`|1A| 25|
|`_`     |`\x5F`        | 1| 26|
|`a`..`z`|`\x61`..`\x7A`|1A| 40|

## 64 bit platform

Alignment: 8 bytes.

Pointer: 2^64 / 2^3 = 2^61 bit

### Value

- `63`: 9 x 7 bit string
- `63`:
  - `61`: pointer + null, alignment - 8 bytes
  - `61`:
    - `60`: 4 x 15 bit string
    - `60`: 10 x 6 bit string
  - `61`:
    - `60`: 6 x 10 bit string
    - `60`: 5 x 12 bit string
  - `61`
    - `60`: float60
    - `60`:
      - `59`: bigInt59 (-576_460_752_303_423_488..576_460_752_303_423_487)
      - `59`:
        - `56`: 8 x 7-bit string
        - `56`: 7 x 8-bit string
        - `53`: int53
        - `53`: stringUInt53
        - `48`: 3 x 16 bit string
        - `32`: 2 x 16 bit string
        - `16`: 1 x UTF16 string
        - `3`: common

## Float64

https://en.wikipedia.org/wiki/Double-precision_floating-point_format

- 1 bit - sign (S)
- 11 bit - exponent (E)
- 52 bit - fraction (F)

|E            |Description             |
|-------------|------------------------|
|000_0000_0000|F = 0: signed zeros     |
|             |F != 0: subnormals      |
|000_0000_0001|E = 2^-1022             |
|...          |                        |
|011_1111_1111|E = 2^0                 |
|100_0000_0000|E = 2^1                 |
|...          |                        |
|111_1111_1110|E = 2^1023              |
|111_1111_1111|F = 0: signed infinities|
|             |F != 0: NaN             |

## Float60

- 1 bit - sign
- 7 bit - exponent
- 52 bit - fraction

|E       |Description|
|--------|-----------|
|000_0000|E = 2^-63  |
|...     |           |
|011_1111|E = 2^0    |
|100_0000|E = 2^1    |
|...     |           |
|111_1111|E = 2^64   |

Note: the type has no `+0`, `-0`, `+inf`, `-inf`, `NaN`.

## Object Structure

Value Size = 8
Counter size = max_memory_size / value_size.

### Type

- `000`: double
- `001`: string
- `010`: array
- `011`: object
- `100`: bigInt
- `101`: function
- `110`:
- `111`:

### Type & Counter

- AtomicUSize:
  - `3`: type
  - `...`: counter

### String

```rust
struct String {
  length: u32,
  array: [u16; self.length],
}
```

### Function

```rust
struct Function<length: u32> {
  func: pointer,
  array: [value; length]
}
```

### BigInt

```rust
struct BigInt {
  length: u32,
  array: [u64; self.length],
}
```

### Array

```rust
struct Array {
  length: u32,
  array: [Value; self.length],
}
```

### Object

```rust
struct Object {
  length: u32,
  array: [(Value, Value), self.length],
  indexArray: [u32, (self.length * log2(self.length) + 31) / u32],
}
```

Note: see https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys and https://262.ecma-international.org/6.0/#sec-object-type

An integer index for Node.js, Deno and Bun means a value from `0` to `4294967294` including. 4_294_967_294 = 0xFFFF_FFFE. But an integer index in the ES6 standard is +0..2^53-1.
