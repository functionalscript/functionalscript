# Low Level

## NaNVM Value

`64`bits:

- `1` bit: sign
- `11` bits: exponent
- `52` bits: fraction

### String

| Length  | Char Size  | States |Bits| Prefix | Suffix    |
|---------|------------|--------|----|--------|-----------|
| `0`     |            | `2^0`  |    |`00.000`| `00` bits |
| `1`     | `16` Utf16 | `2^16` |    |`00.001`| `16` bits |
| `2`     | `16`       | `2^32` |    |`00.010`| `32` bits |
| `3`     | `16`       | `2^48` |`48`|`00.1--`| `48` bits |
| `4`     | `7` ASCII  | `2^28` |    |`01.000`| `28` bits |
| `5`     | `7`        | `2^35` |    |`01.001`| `35` bits |
| `6`     | `7`        | `2^42` |    |`01.010`| `42` bits |
| `7`     | `7`        | `2^49` |`49`|`10.---`| `49` bits |
| `8`     | `6` Id     | `2^48` |`48`|`11.0--`| `48` bits |
|**Total**|            | `2^51` |    |        |           |

Id: `0..9`, `A..Z`, `a..z`, `$_`.

### Pointers

`48` or `56` address spaces.

Alignments:

|     | Bytes |  Bits |
|-----|-------|-------|
| `0` | `1`   |   `8` |
| `1` | `2`   |  `16` |
| `2` | `4`   |  `32` |
| `3` | `8`   |  `64` |
| `4` | `16`  | `128` |
| `5` | `32`  | `256` |

**Fail-fast** design: as soon as a function receives a pointer to allocated memory, the function tests it with an encoding hypothesis. If the hypothesis is confirmed, the function encodes the pointer, otherwise it panics. For example:

```rust
const MASK: u64 = 0xFFFF_0000_0000_0000;
assert_eq!(address & MASK, 0, "pointer exceeds NaNPtr address range");
```

Additional bits:

|                   | Values                                   | States |Total|Bits|
|-------------------|------------------------------------------|--------|-----|----|
| static or dynamic | `true`, `false`                          | `*2`   |`2`  |`1` |
| types             | `object`, `string`, `bigint`, `function` | `4`    |`8`  |`3` |
| extra types 1     | `array`, `Map`, `Set`, `iterable`        | `+4`   |`16` |`4` |
| extra types 4     | `RegEx`, `Temporal`, etc.                | `+8`   |`32` |`5` |

## Capacity

|                            |        | Prefix | Info                                        |
|----------------------------|--------|--------|---------------------------------------------|
|short `string` or primitive | `2^51` |`00`    | Strings + primitives and non-finite numbers |
|`ref`                       | `2^51` |`01`    | Pointer + data types                        |
|short `bigint`              | `2^52` |`1X`    | Sign and 51 bit uint                        |
|**Total**                   | `2^53` |        |                                             |

## Structure

- `1` bit: sign
- `11` bits: exponent
- `52` bits: fraction

## NaN and Infinities

- exponent: `0b_111_1111_1111`.
- sign and fraction: 53 bits = 0x35 bits
- 3 special values:
  ```js
  //               3    3    2    2    2    2    1    1    1    1    0    0    0    0
  //               4    0    C    8    4    0    C    8    4    0    C    8    4    0
   Infinity === 0b_0_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000
  -Infinity === 0b_1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000
   NaN // everything else
  ```

```
0
0    4    8    C
s111_1111_1111_vvvv - rest: 48bit

s111_1111_1111_00vv - primitives and short strings
s111_1111_1111_01vv - ptr + data_type
s111_1111_1111_1vvv - short bigint
```

### Primitives and Short Strings

`s-vv` + 48 bit

| | s | vv |             |       |    |
|-|---|----|-------------|-------|----|
|+|`s`|`00`|primitive:   |       |    |
| |`s`|`00`|`00`         |inf    |    |
| |`s`|`00`|`01`         |NaN    |    |
| |`s`|`00`|`10`         |bool   |    |
| |`s`|`00`|`11`         |nullish|    |
|+|`s`|`01`|short string:|       |    |
| |`0`|`01`|`00`         |`""`   |    |
| |`0`|`01`|`01`         |`1x16` |    |
| |`0`|`01`|`10`         |`2x16` |    |
| |`1`|`01`|`00`         |`4x7`  |    |
| |`1`|`01`|`01`         |`5x7`  |    |
| |`1`|`01`|`10`         |`6x7`  |    |
|+|`s`|`1v`|short string:|       |    |
| |`0`|`10`|             |`3x16` |`48`|
| |`0`|`11`|             |`8x6`  |`48`|
| |`1`|`1v`|             |`7x7`  |`49`|

### Ptr and Data Types

- `s` - is static;
- `vv` - data type: `object`, `string`, `bigint`, `function`.

### Short BigInt

- `s` - sign;
- `vvv` - 3 high bits of `uint51`.
