# Low Level

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

Format:

```
s111_1111_1111_vvvv
vvvv_vvvv_vvvv_vvvv
vvvv_vvvv_vvvv_vvvv
vvvv_vvvv_vvvv_vvvv
```

|                     |                        |
|---------------------|------------------------|
|`s111_1111_1111_00vv`|primitives and short str|
|`s111_1111_1111_01vv`|pointer                 |
|`s111_1111_1111_1vvv`|short bigint            |

### Primitives and Short Strings

`s-00vv` + 48 bit

|         | s | vv |extra|         |    |
|---------|---|----|-----|---------|----|
|primitive|`s`|`00`|     |         |    |
|         |`s`|`00`|`00` |inf,NaN  |    |
|         |`0`|`00`|`01` |bool     |    |
|         |`0`|`00`|`10` |null     |    |
|         |`0`|`00`|`11` |undefined|    |
|short str|`s`|`01`|     |         |    |
|         |`0`|`01`|`00` |`""`     |`0` |
|         |`0`|`01`|`01` |`1x16`   |`16`|
|         |`0`|`01`|`10` |`2x16`   |`32`|
|         |`1`|`01`|`00` |`4x7`    |`28`|
|         |`1`|`01`|`01` |`5x7`    |`35`|
|         |`1`|`01`|`10` |`6x7`    |`42`|
|short str|`s`|`1_`|     |         |    |
|         |`0`|`10`|     |`3x16`   |`48`|
|         |`0`|`11`|     |`8x6`    |`48`|
|         |`1`|`1_`|     |`7x7`    |`49`|

### Ptr

- `s` - is static;
- `vv` - data type: `object`, `string`, `bigint`, `function`.

### Short BigInt

- `s` - sign;
- `vvv` - 3 high bits of `uint51`.

```rust
const PRIMITIVE : u64 = 0x7FFF_C000_0000_0000;

const NON_FINITE: u64 = 0x7FF0_0000_0000_0000;
const INF       : u64 = 0x7FF0_0000_0000_0000;
const NEG_INF   : u64 = 0xFFF0_0000_0000_0000;
const NAN       : u64 = 0x7FF0_0000_0000_0001;

const BOOL      : u64 = 0x7FF0_4000_0000_0000;
const FALSE     : u64 = 0x7FF0_4000_0000_0000;
const TRUE      : u64 = 0x7FF0_4000_0000_0001;

const NULLISH   : u64 = 0x7FF0_C000_0000_0000;

const NULL      : u64 = 0x7FF0_8000_0000_0000;
const UNDEFINED : u64 = 0x7FF0_C000_0000_0000;

fn is_finite(a: u64) -> bool {
  a & 0x7FF0_0000_0000_0000 != 0x7FF0_0000_0000_0000
}

fn is_number(a: u64) -> bool {
  // is_finite(a) || (a & PRIMITIVE == NON_FINITE)
  a & 0x7FFF_C000_0000_0000 <= 0x7FF0_0000_0000_0000
}

fn is_bool(a: u64) -> bool {
  a & PRIMITIVE == 0x7FF0_4000_0000_0000
}

fn is_short_string(a: u64) -> bool {
  (a & 0x7FFC_0000_0000_0000 == 0x7FF0_0000_0000_0000) &&
  (a & 0x0003_0000_0000_0000 != 0x0000_0000_0000_0000)
}

fn is_ptr(a: u64) -> bool {
  a & 0x7FFC_0000_0000_0000 == 0x7FF4_0000_0000_0000
}

const SHORT_BIGINT: u64 = 0x7FF8_0000_0000_0000

fn is_short_bigint(a: u64) -> bool {
  a & SHORT_BIGINT == SHORT_BIGINT
}
```
