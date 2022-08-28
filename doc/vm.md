# NaNVM

https://en.wikipedia.org/wiki/Double-precision_floating-point_format

https://anniecherkaev.com/the-secret-life-of-nan
https://brionv.com/log/2018/05/17/javascript-engine-internals-nan-boxing/


- 1 bit - sign (S)
- 11 bit - exponent (E)
- 52 bit - fraction (F)

|SE |F             |Value           |
|---|--------------|----------------|
|000|00000_00000000|+000000_00000000|
|...|              |                |
|3FF|00000_00000000|+000000_00000001|
|...|              |                |
|434|00000_00000000|+200000_00000000|
|...|              |                |
|7FF|00000_00000000|+inf            |
|...|              |NaN             |
|800|00000_00000000|-0.0            |
|...|              |                |
|BFF|00000_00000000|-000000_00000001|
|...|              |                |
|C34|00000_00000000|-200000_00000000|
|...|              |                |
|FFF|00000_00000000|-inf            |
|...|              |NaN             |

integer range: `[-2^53; +2^53]`.

## 6-bit Id String

|symbol  |code          |# |sum|
|--------|--------------|--|---|
|`$`     |`\x24`        | 1|  1|
|`0`..`9`|`\x30`..`\x39`| A|  B|
|`A`..`Z`|`\x41`..`\x5A`|1A| 25|
|`_`     |`\x5F`        | 1| 26|
|`a`..`z`|`\x61`..`\x7A`|1A| 40|

## 7FF & FFF

53 bits.

Other values:

- `NaN`
- `+Inf`: 0x7FF00000_00000000
- `-Inf`: 0xFFF00000_00000000
- pointer + null:
  - 32 bit for 32 bit platforms.
  - 48 bit for current AMD64 https://en.wikipedia.org/wiki/X86-64#Canonical_form_addresses and ARM64
    note: with alignments it can be further narrowed to 44-45 bit.
- `true`
- `false`
- `undefined`

Optimization for
- string
- bigInt

Least used letters in English: Q, J, Z and X.

### Layout 52

Starts with `0xFFF`

|      |  |             |type       |
|------|--|-------------|-----------|
|`1111`|48|stringUInt48 |`string`   |
|`1110`|48|8 x 6 string |           |
|`1101`|48|7 x 7 stringA|           |
|`1100`|48|7 x 7 stringB|           |
|`1011`|48|6 x 8 string |           |
|`1010`|45|5 x 9 string |           |
|`1001`|48|4 x 12 string|           |
|`1000`|48|3 x 16 string|           |
|`0111`|32|2 x 16 string|           |
|`0110`|16|1 x 16 string|           |
|`0101`| 0|empty string |           |
|`0100`|48|ptr          |?          |
|`0011`| 0|undefined    |`undefined`|
|`0010`|48|bigInt48     |`bigint`   |
|`0001`| 0|bool         |`bool`     |
|`0000`| 0|-inf         |`number`   |

## Pointer Kind

Alignment 8 bytes. 3 bits.

|    |type      |               |
|----|----------|---------------|
|00.0|`object`  |object         |
|00.1|          |array          |
|01.0|`string`  |string         |
|01.1|          |               |
|10.0|`function`|function       |
|10.1|          |static function|
|11.0|`bigint`  |bigint         |
|11.1|          |               |

## Object

```rust
struct Object {
  propertySet: PropertySet
  iterable: Func<Iterator>
}

struct Array {
  length: u32,
  array: [Value; self.lenght],
}
```

## String

```rust
struct String {
  length: u32,
  array: [u16; self.length],
}
```

## Function

```rust
struct Function {
  pointer: FunctionBody,
  array: [Value; length],
}
```

## BigInt

```rust
struct BigInt {
  length: u32,
  array: [u64; self.length],
}
```

## Order of object properties

See https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys and https://262.ecma-international.org/6.0/#sec-object-type

An integer index for Node.js, Deno and Bun means a value from `0` to `4294967294` including. 4_294_967_294 = 0xFFFF_FFFE. But an integer index in the ES6 standard is +0..2^53-1.
