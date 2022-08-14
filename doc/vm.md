# VM

Value:

- bool
- number : float64
- string
- null
- undefined
- object `{...}`
- array `[]`
- function `() = {}`

[Tagged Pointer](https://en.wikipedia.org/wiki/Tagged_pointer).

## Common (3 bit)

|#  |value      |
|---|-----------|
|000|`false`    |
|001|`true`     |
|010|`undefined`|
|011|`""`       |
|100|`-0`       |
|101|`+infinity`|
|110|`-infinity`|
|111|`NaN`      |


## 6-bit Id String

|symbol  |code          |# |sum|
|--------|--------------|--|---|
|`$`     |`\x24`        | 1|  1|
|`0`..`9`|`\x30`..`\x39`| A|  B|
|`A`..`Z`|`\x41`..`\x5A`|1A| 25|
|`_`     |`\x5F`        | 1| 26|
|`a`..`z`|`\x61`..`\x7A`|1A| 40|

## Value

Alignment: 8 bytes.

Pointer: 2^64 / 2^3 = 2^61 bit.

- `63`: 9 x 7 bit string
- `63`:
  - `61`: pointer + null, alignment - 8 bytes
  - `61`:
    - `60`: 10 x 6 bit string
    - `60`: 6 x 10 bit string
  - `61`:
    - `60`: 5 x 12 bit string
    - `60`: 4 x 15 bit string
  - `61`
    - `60`: float60
    - `60`:
      - `59`: bigInt59 (-576_460_752_303_423_488..576_460_752_303_423_487)
      - `59`:
        - `56`: 8 x 7-bit string
        - `56`: 7 x 8-bit string
        - `53`: stringUInt53 "an integer index".
        - `48`: 3 x 16 bit string
        - `32`: 2 x 16 bit string
        - `16`: 1 x UTF16 string
        - `3`: common

|bit              |                 |
|-----------------|-----------------|
|`__ ___ _ _ __.1`|9 x 7 bit string |
|`__ ___ _ _.00.0`|pointer + null   |
|`__ ___ _ 0.01.0`|10 x 6 bit string|
|`__ ___ _ 1.01.0`|6 x 10 bit string|
|`__ ___ _ 0.10.0`|5 x 12 bit string|
|`__ ___ _ 1.10.0`|4 x 15 bit string|
|`__ ___ _.0.11.0`|float60          |
|`__ ___.0.1.11.0`|bigInt59         |
|`__ 000.1.1.11.0`|8 x 7 bit string |
|`__ 001.1.1.11.0`|7 x 8 bit string |
|`__ 010.1.1.11.0`|stringUInt53     |
|`__ 011.1.1.11.0`|3 x 16 bit string|
|`__ 100.1.1.11.0`|2 x 16 bit string|
|`__ 101.1.1.11.0`|1 x 16 bit string|
|`00.110.1.1.11.0`|false            |
|`01.110.1.1.11.0`|true             |
|`10.110.1.1.11.0`|undefine         |
|`11.110.1.1.11.0`|""               |
|`00.111.1.1.11.0`|-0.0             |
|`01.111.1.1.11.0`|+inf             |
|`10.111.1.1.11.0`|-inf             |
|`11.111.1.1.11.0`|NaN              |

## Float60

- 1 bit - sign
- 7 bit - exponent
- 52 bit - fraction

|SE|F             |V                 |     |
|--|--------------|------------------|-----|
|00|00000_00000000|+00000000_00000000|i    |
|  |...           |...               |f    |
|3F|00000_00000000|+00000000_00000001|i    |
|40|00000_00000000|+00000000_00000002|i    |
|40|80000_00000000|+00000000_00000003|i    |
|41|00000_00000000|+00000000_00000004|i    |
|  |...           |...               |i    |
|43|10000_00000000|+00000000_00000011|i    |
|  |...           |...               |i    |
|73|00000_00000001|+00100000_00000001|i    |
|  |...           |...               |i    |
|73|FFFFF_FFFFFFFF|+001FFFFF_FFFFFFFF|i    |
|74|00000_00000000|+00200000_00000000|i.max|
|74|00000_00000001|+00200000_00000002|f    |
|  |...           |...               |f    |
|75|00000_00000001|+00400000_00000004|f    |
|  |...           |...               |f    |
|77|00000_00000001|+01000000_00000010|f    |
|  |...           |...               |f    |
|7B|00000_00000001|+10000000_00000100|f    |
|  |...           |...               |f    |
|7E|00000_00000001|+80000000_00000800|f    |
|  |...           |...               |f    |
|7E|FFFFF_FFFFFFFF|+FFFFFFFF_FFFFF800|f    |
|7F|00000_00000000|+inf              |     |
|  |...           |NaN               |     |
|80|00000_00000000|-0.               |f    |
|BF|00000_00000000|-00000000_00000001|i    |
|C0|00000_00000000|-00000000_00000002|i    |
|F4|00000_00000000|-00200000_00000000|i.min|
|F4|00000_00000001|-00200000_00000002|f    |
|  |...           |...               |f    |
|FE|FFFFF_FFFFFFFF|-FFFFFFFF_FFFFF800|f    |
|FF|00000_00000000|-inf              |f    |
|  |...           |NaN               |f    |

Note: the type has no `+0`, `-0`, `+inf`, `-inf`, `NaN`.

## Dynamic Value

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
