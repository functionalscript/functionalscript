# VM

[Tagged Pointer](https://en.wikipedia.org/wiki/Tagged_pointer).

## Common (3 bit)

- `false`
- `true`
- `undefined`
- `""`
- `-infinity`
- `+infinity`
- `-0`
- `NaN`

## 6-bit Id String

6-bit string

|symbol  |code          |# |sum|
|--------|--------------|--|---|
|`$`     |`\x24`        | 1|  1|
|`0`..`9`|`\x30`..`\x39`| A|  B|
|`A`..`Z`|`\x41`..`\x5A`|1A| 25|
|`_`     |`\x5F`        | 1| 26|
|`a`..`z`|`\x61`..`\x7A`|1A| 40|

## 32 bit platform with ref counter.

Pointer = 2^32 / 2^3 = 2^29

### Object Structure

Memory max size is 2^32.

String max size is 2^32 / 2 (UTF-8 size) = 2^31.

Counter max size is 2^32 / 4 (pointer size) = 2^30.
Array max size is 2^32 / 4 (pointer size) = 2^30.

Object max size is 2^32 / 8 (a size of 2 pointers) = 2^29
BigInt max size is 2^32 / 8 (uint64 size) = 2^29.
See https://doc.rust-lang.org/std/primitive.u64.html#method.carrying_mul

- counter `32`
  - type: `2`
    - double
    - int32
    - function
    - varObject
- len:
  - `31`: string
  - `31`:
    - `30`: array
    - `30`:
      - `29`: object
      - `29`: bigint

double: 4+8 = 12 (or 16 if aligned)
int32: 4+4 = 8
function: 4+4+4 = 12
object: 8+
array: 8+
string: 8+
bigint: 8+

### Pointer32

- `30`: 5 x 6 bit string
- `30`: pointer + null, alignment - 4 bytes.
- `30`:
  - `29`: bigInt30 (-268_435_456..268_435_456)
  - `29`: int28 (-268_435_456..268_435_456)
- `30`:
  - `28`: 4 x 7 bit string
  - `28`: 2 x 14 bit string
  - `28`:
    - `27`: 3 x 9 bit string
    - `27`:
      - `20`: a UTF-16 surrogate pair
      - `16`: 1 x 16 bit string
      - `3`: common

## 64 bit platform

Pointer = 2^32 / 2^3 = 2^29

### Object Structure

Memory max size is 2^64.

String max size is 2^64 / 2^1 (UTF-8 size) = 2^63. JS limitation: 2^53
BigInt max size is 2^64 / 2^2 (uint32 size) = 2^62.

Counter max size is 2^64 / 2^3 (pointer size) = 2^61
Array max size is 2^64 / 2^3 (pointer size) = 2^61. JS limitation: 2^32
Object max size is 2^64 / 2^4 (a size of 2 pointers) = 2^60. JS limitation: 2^53

- type&counter (64 bit)
  - type: 3 bit
  - counter: 61 bit

- type:
  - double
  - function
  - 

### Pointer64

- `63`: 9 x 7 bit string
- `63`:
  - `61`: pointer + null, alignment - 8 bytes
  - `61`:
    - `60`: float60
    - `60`: 10 x 6 bit string
  - `61`:
    - `60`: 6 x 10 bit string
    - `60`: 5 x 12 bit string
  - `61`
    - `60`: 4 x 15 bit string
    - `60`:
      - `59`: bigInt59 (-576_460_752_303_423_488..576_460_752_303_423_487)
      - `59`:
        - `56`: 8 x 7-bit string
        - `56`: 7 x 8-bit string
        - `48`: 3 x 16 bit string
        - `32`: 2 x 16 bit string
        - `32`: int32
        - `32`: stringUInt32
        - `16`: 1 x UTF16 string
        - `3`: common

### Float64

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

### Float60

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

## Object Structure

- type&counter: 32 + float64: 64
- type&counter: 32 + int32: 32
- type&counter: 32 + object: len: 32 + payload
- type&counter: 32 + array: len: 32 + payload
- type&counter: 32 + function: 32 + 32
- type&counter: 32 + string: len: 32 + payload
- type&counter: 32 + bigint: len: 32 + payload

Max length of JS string/array/object can't be bigger that 2^53-1

Array index can't be bigger than 2^32-1

## Type

- 00 float64
- 10 function
- 01 string or bigint
- 11 object.
    - object
    - array

## Type & counter

|field  |x32   |x64   |
|-------|------|------|
|type   |29..31|61..63|
|counter|0..28 |0..62 |

## Using Pools for small objects

|type        |size on x32|size on x64|
|------------|-----------|-----------|
|float64     |4+8 = 12   |8+8 = 16   |
|function    |4+4+4 = 12 |8+8+8 = 24 |
|int32       |4+4 = 8    |8+4 = 12   |
|empty object|4+4 = 8    |8+4 = 12   |
|empty array |4+4 = 8    |8+4 = 12   |

## Array

```rust
struct FsArray {
  typeAndCounter: AtomicUSize,
  length: usize,
  items: [FsPointer; self.length],
}
```

## Object

```rust
struct FsObject {
  typeAndCounter: AtomicUSize,
  length: usize,
  propertyArray: [(FsString, FsPointer), self.length],
  indexArray: [usize, (self.length * log2(self.length) + usize::BITS - 1) / usize::BITS],
}
```

Note: see https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys and https://262.ecma-international.org/6.0/#sec-object-type

An integer index for Node.js, Deno and Bun means a value from `0` to `4294967294` including. 4_294_967_294 = 0xFFFF_FFFE. But an integer index in the ES6 standard is +0..2^53-1.
