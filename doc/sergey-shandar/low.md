# Low Level

## NaNVM Value

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

### String

| Length  | Char Size  | States |Bits| Prefix | Suffix    |
|---------|------------|--------|----|--------|-----------|
| `0`     |            | `2^0`  |    |`00.000`| `00` bits |
| `1`     | `16` Utf16 | `2^16` |    |`00.001`| `16` bits |
| `2`     | `16`       | `2^32` |    |`00.010`| `32` bits |
| `3`     | `16`       | `2^48` |`48`|`00.1--`| `46` bits |
| `4`     | `7` ASCII  | `2^28` |    |`01.000`| `28` bits |
| `5`     | `7`        | `2^35` |    |`01.001`| `35` bits |
| `6`     | `7`        | `2^42` |    |`01.010`| `42` bits |
| `7`     | `7`        | `2^49` |`49`|`10.---`| `46` bits |
| `8`     | `6` Id     | `2^48` |`48`|`11.0--`| `46` bits |
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

|         |        | Prefix | Info                                        |
|---------|--------|--------|---------------------------------------------|
|`string` | `2^51` |`00`    | Strings + primitives and non-finite numbers |
|`pointer`| `2^51` |`01`    | Pointer + data types                        |
|`bigint` | `2^52` |`1X`    | Sign and 51 bit uint                        |
|**Total**| `2^53` |        |                                             |
